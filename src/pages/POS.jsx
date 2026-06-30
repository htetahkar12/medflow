import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

export default function POS({ clinicMode }) {
  const [checkoutQueue, setCheckoutQueue] = useState([]);
  const [selectedCheckout, setSelectedCheckout] = useState(null);
  
  // Invoice details
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [consultationFee, setConsultationFee] = useState(0);
  const [investigationFee, setInvestigationFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [clinicConfig, setClinicConfig] = useState(null);

  // Active print invoice state
  const [printInvoiceData, setPrintInvoiceData] = useState(null);
  const [printPaperSize, setPrintPaperSize] = useState('thermal'); // 'thermal' | 'a4'

  // Custom charge inputs
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [servicesCatalog, setServicesCatalog] = useState([]);

  useEffect(() => {
    loadCheckoutQueue();
    loadClinicConfig();
    loadServicesCatalog();
  }, []);

  const loadClinicConfig = async () => {
    const config = await db.get('settings', 'clinic_config');
    setClinicConfig(config);
  };

  const loadServicesCatalog = async () => {
    try {
      const catalog = await db.get('settings', 'investigations_catalog');
      if (catalog && catalog.servicesOptions) {
        setServicesCatalog(catalog.servicesOptions);
      }
    } catch (e) {
      console.error('Failed to load services catalog in POS:', e);
    }
  };

  const loadCheckoutQueue = async () => {
    try {
      const bookings = await db.getAll('bookings');
      const patients = await db.getAll('patients');
      const doctors = await db.getAll('doctors');
      const clinicId = syncManager.getClinicId();

      // Find bookings pending checkout (either finished consultation directly, or finished lab tests)
      const queue = bookings
        .filter(b => b.status === 'pending_checkout' && b.clinic_id === clinicId)
        .map(b => {
          const patient = patients.find(p => p.id === b.patient_id);
          const doctor = doctors.find(d => d.id === b.doctor_id);
          return {
            ...b,
            patientName: patient ? patient.name : 'Unknown Patient',
            patientPhone: patient ? patient.phone : 'N/A',
            doctorName: doctor ? doctor.name : 'Unassigned',
            doctorFee: doctor ? Number(doctor.fees) || 0 : 0
          };
        });

      setCheckoutQueue(queue);
    } catch (e) {
      console.error(e);
    }
  };

  const startCheckout = async (booking) => {
    try {
      const clinicId = syncManager.getClinicId();
      
      // Load consultation file for prescription details
      const consults = await db.getAll('consultations');
      const consult = consults.find(c => c.booking_id === booking.id && c.clinic_id === clinicId);
      
      // Load inventory to match prices
      const inventory = await db.getAll('inventory');
      
      // Pull prescribed medicines
      const prescriptions = consult ? consult.prescriptions || [] : [];
      
      const items = prescriptions.map(p => {
        const invItem = inventory.find(i => i.id === p.medicine_id);
        const unitPrice = invItem ? Number(invItem.selling_price_per_tab) || 0 : 0;
        const totalCost = unitPrice * (Number(p.quantity) || 0);

        return {
          medicine_id: p.medicine_id,
          name: p.name,
          quantity: Number(p.quantity) || 0,
          unitPrice,
          totalCost
        };
      });

      // Load EMR ordered custom services (e.g. Injection, Nebulizer)
      const customServices = consult ? consult.custom_services || [] : [];
      const serviceItems = customServices.map(s => ({
        medicine_id: '',
        name: s.name,
        quantity: 1,
        unitPrice: Number(s.price) || 0,
        totalCost: Number(s.price) || 0,
        type: 'custom'
      }));

      // Calculate lab investigation fees set by EMR
      const allInv = await db.getAll('investigations');
      const bookingInv = allInv.filter(i => i.consultation_id === `CS-${booking.id}` && i.clinic_id === clinicId);
      
      const catalog = await db.get('settings', 'investigations_catalog');
      const catalogLabs = catalog ? catalog.labOptions || [] : [];
      const catalogRads = catalog ? catalog.radOptions || [] : [];

      let testFee = 0;
      bookingInv.forEach(inv => {
        if (inv.price !== undefined) {
          testFee += Number(inv.price) || 0;
        } else {
          // Resolve from catalog settings default_fee
          const labMatch = catalogLabs.find(t => t.name === inv.test_name);
          const radMatch = catalogRads.find(t => t.name === inv.test_name);
          if (labMatch) {
            testFee += Number(labMatch.default_fee) || 5000;
          } else if (radMatch) {
            testFee += Number(radMatch.default_fee) || 10000;
          } else {
            // Hard fallback
            const isLab = ['CBC (Blood Count)', 'Lipid Profile', 'LFT (Liver)', 'KFT (Kidney)', 'FBS (Blood Sugar)'].includes(inv.test_name);
            testFee += isLab ? 5000 : 10000;
          }
        }
      });

      // Resolve consultation fee set by doctor or default booking fee
      const doctorConsultFee = consult && consult.consultation_fee !== undefined 
        ? Number(consult.consultation_fee) 
        : (booking.doctorFee || 5000);

      setSelectedCheckout(booking);
      setInvoiceItems([...items, ...serviceItems]);
      setConsultationFee(doctorConsultFee);
      setInvestigationFee(testFee);
      setDiscount(0);
      setTax(0);
    } catch (e) {
      console.error(e);
    }
  };

  const addCustomFee = (e) => {
    e.preventDefault();
    if (!customName || !customPrice) return;
    const priceVal = parseFloat(customPrice) || 0;
    const newItem = {
      medicine_id: `custom-${Date.now()}`,
      name: customName,
      quantity: 1,
      unitPrice: priceVal,
      totalCost: priceVal,
      type: 'custom'
    };
    setInvoiceItems([...invoiceItems, newItem]);
    setCustomName('');
    setCustomPrice('');
  };

  // Calculations helper
  const getSubtotal = () => {
    const medicinesTotal = invoiceItems.reduce((acc, curr) => acc + curr.totalCost, 0);
    return medicinesTotal + consultationFee + investigationFee;
  };

  const getTotal = () => {
    const sub = getSubtotal();
    return sub + Number(tax) - Number(discount);
  };

  // Checkout transaction
  const handleFinalizeCheckout = async (e) => {
    e.preventDefault();
    if (!selectedCheckout) return;

    try {
      const clinicId = syncManager.getClinicId();
      const saleId = `SL-${Date.now()}`;
      const subtotal = getSubtotal();
      const total = getTotal();

      // 1. Prepare inventory updates (deduct stock levels using FEFO batch-costing)
      const inventory = await db.getAll('inventory');
      const finalizedItems = [];

      for (const item of invoiceItems) {
        if (item.type === 'custom') {
          finalizedItems.push(item);
          continue;
        }

        const invItem = inventory.find(i => i.id === item.medicine_id);
        if (invItem) {
          const currentStock = Number(invItem.total_tablets) || 0;
          const qtyToDeduct = Number(item.quantity) || 0;
          const newStock = Math.max(0, currentStock - qtyToDeduct);

          const currentBatches = invItem.batches ? [...invItem.batches] : [];
          // Sort by expiry (FEFO)
          currentBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

          let remainingToDeduct = qtyToDeduct;
          let totalCostForThisItem = 0;

          const updatedBatches = currentBatches.map(batch => {
            if (remainingToDeduct === 0) return batch;
            const batchStock = Number(batch.quantityOnHand) || 0;
            const deductFromBatch = Math.min(remainingToDeduct, batchStock);

            if (deductFromBatch > 0) {
              totalCostForThisItem += deductFromBatch * (Number(batch.costPrice) || 0);
              remainingToDeduct -= deductFromBatch;
              return {
                ...batch,
                quantityOnHand: batchStock - deductFromBatch
              };
            }
            return batch;
          });

          // Fallback cost if oversold
          if (remainingToDeduct > 0) {
            totalCostForThisItem += remainingToDeduct * ((Number(invItem.selling_price_per_tab) || 0) * 0.6);
          }

          const averageCostPrice = qtyToDeduct > 0 ? (totalCostForThisItem / qtyToDeduct) : 0;
          const finalBatches = updatedBatches.filter(b => b.quantityOnHand > 0);
          const closestExpiry = finalBatches.length > 0 ? finalBatches[0].expiryDate : invItem.expiry_date;

          const updated = {
            ...invItem,
            total_tablets: newStock,
            expiry_date: closestExpiry,
            batches: finalBatches
          };
          await db.save('inventory', updated);

          finalizedItems.push({
            ...item,
            costPrice: averageCostPrice,
            totalCostPrice: totalCostForThisItem
          });
        } else {
          finalizedItems.push(item);
        }
      }

      // 2. Save sales record
      const salesRecord = {
        id: saleId,
        clinic_id: clinicId,
        booking_id: selectedCheckout.id,
        patient_id: selectedCheckout.patient_id,
        doctor_id: selectedCheckout.doctor_id,
        doctorFee: consultationFee,
        investigationFee: investigationFee,
        subtotal,
        tax: Number(tax) || 0,
        discount: Number(discount) || 0,
        total,
        payment_method: paymentMethod,
        items: finalizedItems,
        timestamp: new Date().toISOString()
      };

      await db.save('sales', salesRecord);

      // 3. Update Booking status to 'completed'
      const booking = await db.get('bookings', selectedCheckout.id);
      if (booking) {
        booking.status = 'completed';
        await db.save('bookings', booking);
      }

      alert('POS Transaction Completed! Stock levels updated. Opening print preview.');
      
      // Load print preview layout
      setPrintInvoiceData({
        ...salesRecord,
        patientName: selectedCheckout.patientName,
        doctorName: selectedCheckout.doctorName,
        consultationFee,
        investigationFee
      });

      setSelectedCheckout(null);
      setInvoiceItems([]);
      loadCheckoutQueue();
    } catch (err) {
      console.error('POS Checkout failed:', err);
    }
  };

  const triggerPrintReceipt = () => {
    if (window.AndroidPrintBridge && typeof window.AndroidPrintBridge.printPage === 'function') {
      window.AndroidPrintBridge.printPage();
      setTimeout(() => {
        setPrintInvoiceData(null);
      }, 4000);
    } else {
      window.print();
      setPrintInvoiceData(null);
    }
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Cashier POS Checkout</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review patient clinical charges, collect payments, deduct stocks, and print receipt logs</p>
        </div>
      </header>

      {/* Main Grid */}
      <div className={selectedCheckout ? "responsive-split-grid-50 no-print" : "no-print"}>
        
        {/* Left Side: Pending checkout list */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '1rem' }}>Ready for Checkout</h2>
          {checkoutQueue.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No patients waiting for billing checkout.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {checkoutQueue.map(b => (
                <div 
                  key={b.id} 
                  onClick={() => startCheckout(b)}
                  style={{
                    padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '10px',
                    cursor: 'pointer', background: selectedCheckout?.id === b.id ? 'var(--primary-light)' : 'var(--bg-surface-solid)',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong style={{ color: selectedCheckout?.id === b.id ? 'var(--primary)' : 'var(--text-primary)' }}>{b.patientName}</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>{(b.doctorFee || 0).toLocaleString()} Ks</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Patient ID: {b.patient_id} | Consulted by: {b.doctorName}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Invoice processing details */}
        {selectedCheckout && (
          <form onSubmit={handleFinalizeCheckout} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>Billing Sheet: {selectedCheckout.patientName}</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Booking ID: {selectedCheckout.id}</span>
              </div>
              <button type="button" onClick={() => setSelectedCheckout(null)} className="btn btn-secondary btn-icon">✕</button>
            </div>

            {/* Fees Breakdown List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                <span>Doctor Consultation Fee ({selectedCheckout.doctorName})</span>
                {clinicMode === 'medium_clinic' ? (
                  <input 
                    type="number" 
                    value={consultationFee} 
                    onChange={e => setConsultationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '120px', minHeight: '32px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                  />
                ) : (
                  <strong>{consultationFee.toLocaleString()} Ks</strong>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
                <span>Diagnostic Lab / X-Ray Charges</span>
                {clinicMode === 'medium_clinic' ? (
                  <input 
                    type="number" 
                    value={investigationFee} 
                    onChange={e => setInvestigationFee(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ width: '120px', minHeight: '32px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                  />
                ) : (
                  <strong>{investigationFee.toLocaleString()} Ks</strong>
                )}
              </div>
            </div>

            {/* Prescribed Drugs itemized table */}
            <div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Prescribed Medications</h3>
              {invoiceItems.length === 0 ? (
                <div style={{ padding: '1rem', textAlign: 'center', background: 'var(--bg-app)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  No medications prescribed.
                </div>
              ) : (
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <table style={{ minWidth: 'auto', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Medicine</th>
                        <th>Qty</th>
                        <th>Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, idx) => (
                        <tr key={idx}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>{item.unitPrice} Ks</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{item.totalCost.toLocaleString()} Ks</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Custom Fees / Services form */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Add Custom Fee / Service</h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={servicesCatalog.some(s => s.name === customName) ? customName : (customName ? 'custom_manual' : '')}
                  onChange={e => {
                    const selectedName = e.target.value;
                    if (selectedName === 'custom_manual') {
                      setCustomName('');
                      setCustomPrice('');
                    } else if (selectedName === '') {
                      setCustomName('');
                      setCustomPrice('');
                    } else {
                      const match = servicesCatalog.find(s => s.name === selectedName);
                      setCustomName(selectedName);
                      setCustomPrice(match ? String(match.default_fee) : '');
                    }
                  }}
                  style={{ flex: 1.5, minHeight: '34px', padding: '0.35rem' }}
                >
                  <option value="">-- Select Service / Procedure --</option>
                  {servicesCatalog.map(srv => (
                    <option key={srv.name} value={srv.name}>{srv.name} ({(srv.default_fee || 0).toLocaleString()} Ks)</option>
                  ))}
                  <option value="custom_manual">➕ Custom Write-in...</option>
                </select>

                {(!servicesCatalog.some(s => s.name === customName) || customName === '') && (
                  <input 
                    type="text" 
                    placeholder="Enter custom service name" 
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    style={{ flex: 1.5, minHeight: '34px', padding: '0.35rem' }}
                  />
                )}

                <input 
                  type="number" 
                  placeholder="Price" 
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value)}
                  style={{ flex: 0.8, minHeight: '34px', padding: '0.35rem' }}
                />
                <button type="button" onClick={addCustomFee} className="btn btn-secondary" style={{ padding: '0.25rem 0.75rem', minHeight: '34px' }}>
                  + Add
                </button>
              </div>
            </div>

            {/* Subtotals & Adjustments */}
            <div style={{ background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal</span>
                <span>{getSubtotal().toLocaleString()} Ks</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
                <span>Discount / Waiver (Ks)</span>
                <input 
                  type="number" 
                  value={discount} 
                  onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ width: '120px', minHeight: '32px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '2rem' }}>
                <span>Clinic Taxes (Ks)</span>
                <input 
                  type="number" 
                  value={tax} 
                  onChange={e => setTax(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ width: '120px', minHeight: '32px', padding: '0.25rem 0.5rem', textAlign: 'right' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ fontSize: '1.1rem' }}>Total Payable</strong>
                <strong style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>{getTotal().toLocaleString()} Ks</strong>
              </div>
            </div>

            {/* Payment Method */}
            <div className="form-group">
              <label>Select Payment Method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option>Cash</option>
                <option>KBZPay</option>
                <option>CBPay / WavePay</option>
                <option>Card Payment</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              <button type="button" onClick={() => setSelectedCheckout(null)} className="btn btn-secondary">Cancel</button>
              <button type="submit" className="btn btn-primary">Complete Billing & Print</button>
            </div>
          </form>
        )}
      </div>

      {/* Printable Thermal Receipt overlay */}
      {printInvoiceData && (
        <div className="modal-overlay no-print">
          <div className="modal-content" style={{ maxWidth: printPaperSize === 'a4' ? '500px' : '360px' }}>
            <div className="modal-header">
              <h3>Print Invoice & Receipt</h3>
              <button className="mobile-menu-btn" onClick={() => setPrintInvoiceData(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Paper Format selection */}
              <div className="form-group">
                <label>Select Invoice Print Layout</label>
                <select value={printPaperSize} onChange={e => setPrintPaperSize(e.target.value)}>
                  <option value="thermal">Thermal Roll Receipt (80mm/58mm)</option>
                  <option value="a4">Standard A4 Invoice Sheet</option>
                </select>
              </div>
              {/* Conditional preview display */}
              {printPaperSize === 'thermal' ? (
                <div className="thermal-receipt-preview" style={{
                  background: '#fff', color: '#000', padding: '1rem', border: '1px solid #ccc',
                  fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: '1.4'
                }}>
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.15rem' }}>
                    {clinicConfig?.clinic_name || 'MEDFLOW CLINIC'}
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', marginBottom: '1rem' }}>
                    {clinicConfig?.address || 'Yangon, Myanmar'}<br/>
                    Tel: {clinicConfig?.phone || '09-xxxxxxxxx'}
                  </div>

                  <div style={{ borderBottom: '1px dashed #000', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                    Date: {new Date(printInvoiceData.timestamp).toLocaleString()}<br/>
                    Invoice ID: {printInvoiceData.id}<br/>
                    Patient: {printInvoiceData.patientName} ({printInvoiceData.patient_id})
                  </div>

                  <table style={{ width: '100%', minWidth: 'auto', border: 'none', marginBottom: '0.5rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #000' }}>
                        <th style={{ textAlign: 'left', background: 'none', padding: '2px 0' }}>Item</th>
                        <th style={{ textAlign: 'center', background: 'none', padding: '2px 0' }}>Qty</th>
                        <th style={{ textAlign: 'right', background: 'none', padding: '2px 0' }}>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 0' }}>Consultation ({printInvoiceData.doctorName})</td>
                        <td style={{ textAlign: 'center', padding: '2px 0' }}>1</td>
                        <td style={{ textAlign: 'right', padding: '2px 0' }}>{printInvoiceData.consultationFee.toLocaleString()}</td>
                      </tr>
                      {printInvoiceData.investigationFee > 0 && (
                        <tr>
                          <td style={{ padding: '2px 0' }}>Lab & Imaging Fees</td>
                          <td style={{ textAlign: 'center', padding: '2px 0' }}>1</td>
                          <td style={{ textAlign: 'right', padding: '2px 0' }}>{printInvoiceData.investigationFee.toLocaleString()}</td>
                        </tr>
                      )}
                      {printInvoiceData.items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '2px 0' }}>{item.name}</td>
                          <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.quantity}</td>
                          <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.totalCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div style={{ borderTop: '1px dashed #000', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Subtotal:</span>
                      <span>{printInvoiceData.subtotal.toLocaleString()} Ks</span>
                    </div>
                    {printInvoiceData.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Discount:</span>
                        <span>-{printInvoiceData.discount.toLocaleString()} Ks</span>
                      </div>
                    )}
                    {printInvoiceData.tax > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tax:</span>
                        <span>+{printInvoiceData.tax.toLocaleString()} Ks</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '2px' }}>
                      <span>Total Paid:</span>
                      <span>{printInvoiceData.total.toLocaleString()} Ks</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginTop: '1.5rem', borderTop: '1px dashed #000', paddingTop: '0.5rem', fontSize: '0.7rem' }}>
                    Thank you! Get well soon.<br/>
                    Powered by AuraClinic PWA
                  </div>
                </div>
              ) : (
                <div className="a4-receipt-preview" style={{
                  background: '#fff', color: '#000', padding: '1rem', border: '1px solid #ccc',
                  fontFamily: 'sans-serif', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #333', paddingBottom: '4px' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: 'var(--primary)' }}>{clinicConfig?.clinic_name || 'MEDFLOW CLINIC'}</strong>
                      <div>{clinicConfig?.address || 'Yangon, Myanmar'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '0.9rem', color: '#555' }}>BILL INVOICE</strong>
                      <div>ID: {printInvoiceData.id}</div>
                    </div>
                  </div>
                  <div>
                    <strong>BILL TO:</strong> {printInvoiceData.patientName} ({printInvoiceData.patient_id})<br/>
                    <strong>PRACTITIONER:</strong> {printInvoiceData.doctorName}
                  </div>
                  <table style={{ width: '100%', minWidth: 'auto', borderCollapse: 'collapse', fontSize: '0.7rem' }}>
                    <thead>
                      <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #94a3b8' }}>
                        <th style={{ padding: '4px', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '4px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '4px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px' }}>Consultation Fee</td>
                        <td style={{ padding: '4px', textAlign: 'center' }}>1</td>
                        <td style={{ padding: '4px', textAlign: 'right' }}>{printInvoiceData.consultationFee.toLocaleString()} Ks</td>
                      </tr>
                      {printInvoiceData.investigationFee > 0 && (
                        <tr>
                          <td style={{ padding: '4px' }}>Lab Diagnostics Fee</td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>1</td>
                          <td style={{ padding: '4px', textAlign: 'right' }}>{printInvoiceData.investigationFee.toLocaleString()} Ks</td>
                        </tr>
                      )}
                      {printInvoiceData.items.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '4px' }}>{item.name}</td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '4px', textAlign: 'right' }}>{item.totalCost.toLocaleString()} Ks</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', borderTop: '1px solid #000', paddingTop: '4px' }}>
                    <div style={{ width: '150px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal:</span>
                        <span>{printInvoiceData.subtotal.toLocaleString()} Ks</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span>Total Paid:</span>
                        <span>{printInvoiceData.total.toLocaleString()} Ks</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Change size selector above to adjust document layout formatting dynamically.
              </p>
            </div>

            <div className="modal-footer">
              <button onClick={() => setPrintInvoiceData(null)} className="btn btn-secondary">Close</button>
              <button onClick={triggerPrintReceipt} className="btn btn-primary">Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print page block specifically rendered for `@media print` */}
      {printInvoiceData && (
        printPaperSize === 'thermal' ? (
          <div className="only-print print-area">
            <div className="thermal-receipt" style={{
              width: '80mm',
              padding: '5mm',
              fontFamily: 'monospace',
              fontSize: '9pt',
              color: '#000',
              background: '#fff'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '12pt' }}>
                {clinicConfig?.clinic_name || 'AURA CLINIC'}
              </div>
              <div style={{ textAlign: 'center', fontSize: '8pt', marginBottom: '10px' }}>
                {clinicConfig?.address || 'Yangon, Myanmar'}<br/>
                Tel: {clinicConfig?.phone || '09-xxxxxxxxx'}
              </div>

              <div style={{ borderBottom: '1px dashed #000', paddingBottom: '5px', marginBottom: '5px' }}>
                Date: {new Date(printInvoiceData.timestamp).toLocaleString()}<br/>
                Invoice ID: {printInvoiceData.id}<br/>
                Patient: {printInvoiceData.patientName} ({printInvoiceData.patient_id})
              </div>

              <table style={{ width: '100%', minWidth: 'auto', border: 'none', marginBottom: '5px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', background: 'none', padding: '2px 0' }}>Item</th>
                    <th style={{ textAlign: 'center', background: 'none', padding: '2px 0' }}>Qty</th>
                    <th style={{ textAlign: 'right', background: 'none', padding: '2px 0' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '2px 0' }}>Consultation ({printInvoiceData.doctorName})</td>
                    <td style={{ textAlign: 'center', padding: '2px 0' }}>1</td>
                    <td style={{ textAlign: 'right', padding: '2px 0' }}>{printInvoiceData.consultationFee.toLocaleString()}</td>
                  </tr>
                  {printInvoiceData.investigationFee > 0 && (
                    <tr>
                      <td style={{ padding: '2px 0' }}>Lab & Imaging Fees</td>
                      <td style={{ textAlign: 'center', padding: '2px 0' }}>1</td>
                      <td style={{ textAlign: 'right', padding: '2px 0' }}>{printInvoiceData.investigationFee.toLocaleString()}</td>
                    </tr>
                  )}
                  {printInvoiceData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '2px 0' }}>{item.name}</td>
                      <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.quantity}</td>
                      <td style={{ textAlign: 'right', padding: '2px 0' }}>{item.totalCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{printInvoiceData.subtotal.toLocaleString()} Ks</span>
                </div>
                {printInvoiceData.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span>
                    <span>-{printInvoiceData.discount.toLocaleString()} Ks</span>
                  </div>
                )}
                {printInvoiceData.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tax:</span>
                    <span>+{printInvoiceData.tax.toLocaleString()} Ks</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '2px' }}>
                  <span>Total Paid:</span>
                  <span>{printInvoiceData.total.toLocaleString()} Ks</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '15px', borderTop: '1px dashed #000', paddingTop: '5px', fontSize: '8pt' }}>
                Thank you! Get well soon.<br/>
                Powered by AuraClinic PWA
              </div>
            </div>
          </div>
        ) : (
          <div className="only-print print-area a4-invoice">
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
              <div>
                <h1 style={{ fontSize: '22pt', fontWeight: 'bold', color: 'var(--primary)', margin: 0 }}>
                  {clinicConfig?.clinic_name || 'AURA CLINIC'}
                </h1>
                <div style={{ fontSize: '10pt', color: '#555', marginTop: '5px' }}>
                  {clinicConfig?.address || 'Yangon, Myanmar'}<br/>
                  Tel: {clinicConfig?.phone || '09-xxxxxxxxx'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '18pt', fontWeight: 'bold', color: '#666', margin: 0 }}>OFFICIAL INVOICE</h2>
                <div style={{ fontSize: '10pt', marginTop: '5px' }}>
                  Invoice ID: <strong>{printInvoiceData.id}</strong><br/>
                  Date: {new Date(printInvoiceData.timestamp).toLocaleString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '8.5pt', color: '#64748b' }}>BILL TO PATIENT:</div>
                <div style={{ fontSize: '11pt', fontWeight: 'bold', marginTop: '3px' }}>{printInvoiceData.patientName}</div>
                <div style={{ fontSize: '9.5pt', color: '#334155', marginTop: '2px' }}>
                  Patient ID: {printInvoiceData.patient_id}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '8.5pt', color: '#64748b' }}>ATTENDING PRACTITIONER:</div>
                <div style={{ fontSize: '10.5pt', fontWeight: 'bold', marginTop: '3px' }}>{printInvoiceData.doctorName}</div>
                <div style={{ fontSize: '9.5pt', color: '#334155' }}>Payment Method: {printInvoiceData.payment_method}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ background: '#0f172a', color: '#fff', textAlign: 'left' }}>
                  <th style={{ padding: '8px', border: '1px solid #334155', fontSize: '9.5pt' }}>Item Description</th>
                  <th style={{ padding: '8px', border: '1px solid #334155', textAlign: 'center', width: '70px', fontSize: '9.5pt' }}>Qty</th>
                  <th style={{ padding: '8px', border: '1px solid #334155', textAlign: 'right', width: '120px', fontSize: '9.5pt' }}>Unit Price (Ks)</th>
                  <th style={{ padding: '8px', border: '1px solid #334155', textAlign: 'right', width: '130px', fontSize: '9.5pt' }}>Total Cost (Ks)</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ fontSize: '9.5pt' }}>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Consultation & Clinical Evaluation</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>1</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{printInvoiceData.consultationFee.toLocaleString()}</td>
                  <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{printInvoiceData.consultationFee.toLocaleString()}</td>
                </tr>
                {printInvoiceData.investigationFee > 0 && (
                  <tr style={{ fontSize: '9.5pt' }}>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>Diagnostics Lab & Medical Imaging Services</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>1</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{printInvoiceData.investigationFee.toLocaleString()}</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{printInvoiceData.investigationFee.toLocaleString()}</td>
                  </tr>
                )}
                {printInvoiceData.items.map((item, idx) => (
                  <tr key={idx} style={{ fontSize: '9.5pt' }}>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0' }}>
                      {item.name} <span style={{ fontSize: '8pt', color: '#666' }}>({item.type === 'custom' ? 'Service/Fee' : 'Pharmacy'})</span>
                    </td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{item.unitPrice.toLocaleString()}</td>
                    <td style={{ padding: '8px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 'bold' }}>{item.totalCost.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '9.5pt' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>{printInvoiceData.subtotal.toLocaleString()} Ks</span>
                </div>
                {printInvoiceData.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                    <span>Discount:</span>
                    <span>-{printInvoiceData.discount.toLocaleString()} Ks</span>
                  </div>
                )}
                {printInvoiceData.tax > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Taxes/VAT:</span>
                    <span>+{printInvoiceData.tax.toLocaleString()} Ks</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11.5pt', borderTop: '2px solid #333', paddingTop: '8px', marginTop: '4px' }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--primary)' }}>{printInvoiceData.total.toLocaleString()} Ks</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '50px', textAlign: 'center', fontSize: '9pt' }}>
              <div>
                <div style={{ borderBottom: '1px solid #999', width: '180px', margin: '0 auto 5px auto', height: '25px' }} />
                <strong>Cashier / Authorized Signature</strong>
              </div>
              <div>
                <div style={{ borderBottom: '1px solid #999', width: '180px', margin: '0 auto 5px auto', height: '25px' }} />
                <strong>Patient / Receiver Signature</strong>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
