import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

// Code39 Generator helper for barcode label printing
function generateCode39Svg(text) {
  const CODE39_MAP = {
    '0': 'bwbwwwbbwb', '1': 'bbbwbwwwbb', '2': 'bwbwbwwwbb', '3': 'bbbwbwbwwb',
    '4': 'bwbwwwbbwb', '5': 'bbbwwwbwbwb', '6': 'bwbwwwbbbwb', '7': 'bwbwwwbwbww',
    '8': 'bbbwwwbwbwb', '9': 'bwbwwwbbbwb', 'A': 'bbbwbwbbwwb', 'B': 'bwbbwbwbbww',
    'C': 'bbbwbbwbwbb', 'D': 'bwbwbbwbbww', 'E': 'bbbwbbwbbww', 'F': 'bwbbwbbwbbw',
    'G': 'bwbwbwbbwbb', 'H': 'bbbwbwbwbbw', 'I': 'bwbbwbwbwbb', 'J': 'bwbwbbwbwbb',
    'K': 'bbbwbwbwwwb', 'L': 'bwbwbbbwwwb', 'M': 'bbbwbwbbbww', 'N': 'bwbwbbwwwbb',
    'O': 'bbbwbwbbwww', 'P': 'bwbbwbbwwwb', 'Q': 'bwbwbbwbbbww', 'R': 'bbbwbwbbwww',
    'S': 'bwbbwbbwwwb', 'T': 'bwbwbbwbbbww', 'U': 'bbbwbbwbwww', 'V': 'bwbbwbbwwww',
    'W': 'bbbwbbwbbww', 'X': 'bwbwbbwbbbww', 'Y': 'bbbwbbwbwww', 'Z': 'bwbbwbbwwww',
    '-': 'bwbwbbwwbww', '.': 'bbbwbbwwbww', ' ': 'bwbbwbbwwbww', '*': 'bwbwbwwbbww',
    '$': 'bwbwbwbwbww', '/': 'bwbwbwbwwbw', '+': 'bwbwwbwbwbw', '%': 'bwwbwbwbwbw'
  };

  const formatted = `*${text.toUpperCase()}*`;
  let result = '';
  for (let i = 0; i < formatted.length; i++) {
    const char = formatted[i];
    const pattern = CODE39_MAP[char] || CODE39_MAP[' '];
    result += pattern + 'w';
  }

  const bars = [];
  let x = 0;
  const height = 30;
  const narrowWidth = 1.2;
  const wideWidth = 2.8;

  for (let i = 0; i < result.length; i++) {
    const isBar = result[i] === 'b';
    const isWide = (i % 2 === 1);
    const width = isWide ? wideWidth : narrowWidth;

    if (isBar) {
      bars.push(<rect key={i} x={x} y={0} width={width} height={height} fill="#000" />);
    }
    x += width;
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${x} ${height}`} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', height: 'auto' }}>
      {bars}
    </svg>
  );
}

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');
  
  // Expiry alerts threshold date (within 3 months)
  const [threeMonthsFromNow] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });

  // Modal States
  const [showItemModal, setShowItemModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // New Item Form
  const [itemForm, setItemForm] = useState({
    name: '',
    generic_name: '',
    barcode: '',
    category: 'Tablet',
    strip_per_box: '10',
    tablet_per_strip: '10',
    total_tablets: '0', // Initial base unit
    reorder_level: '20',
    purchase_price: '',
    selling_price_per_tab: '',
    expiry_date: '',
    batchNumber: ''
  });

  // Restock Form
  const [restockForm, setRestockForm] = useState({
    unitType: 'box', // 'box', 'strip', 'tablet'
    quantity: '',
    batchNumber: '',
    expiryDate: new Date().toISOString().split('T')[0],
    costPrice: ''
  });

  // Printable Barcode label modal
  const [barcodePrintItem, setBarcodePrintItem] = useState(null);
  const [printMode, setPrintMode] = useState('thermal'); // 'thermal' | 'a4_grid'
  const [gridCount, setGridCount] = useState(24);
  const [gridCols, setGridCols] = useState(3);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const allInventory = await db.getAll('inventory');
      const clinicId = syncManager.getClinicId();
      setInventory(allInventory.filter(i => i.clinic_id === clinicId));
    } catch (e) {
      console.error(e);
    }
  };

  // Convert total base units to readable Box + Strip + Tablet format
  const formatPackagingStock = (item) => {
    const totalTabs = Number(item.total_tablets) || 0;
    const stripPerBox = Number(item.strip_per_box) || 1;
    const tabPerStrip = Number(item.tablet_per_strip) || 1;
    const tabsPerBox = stripPerBox * tabPerStrip;

    const box = Math.floor(totalTabs / tabsPerBox);
    const remainder = totalTabs % tabsPerBox;
    const strip = Math.floor(remainder / tabPerStrip);
    const tab = remainder % tabPerStrip;

    return { box, strip, tab, tabsPerBox };
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.expiry_date || !itemForm.selling_price_per_tab) {
      alert('Please fill out name, expiry date, and unit selling price.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      const itemId = `MED-${Date.now()}`;
      
      // Auto-generate barcode if blank
      const finalBarcode = itemForm.barcode || `888${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const stripPerBox = parseInt(itemForm.strip_per_box) || 1;
      const tabPerStrip = parseInt(itemForm.tablet_per_strip) || 1;
      const totalTabs = parseInt(itemForm.total_tablets) || 0;
      const purchasePrice = parseFloat(itemForm.purchase_price) || 0;
      const sellingPrice = parseFloat(itemForm.selling_price_per_tab) || 0;

      // Cost price per tablet calculation
      let calculatedCost = 0;
      if (purchasePrice > 0) {
        calculatedCost = purchasePrice / (stripPerBox * tabPerStrip);
      } else {
        calculatedCost = sellingPrice * 0.6; // default 60% margin fallback
      }

      const newItem = {
        id: itemId,
        clinic_id: clinicId,
        name: itemForm.name,
        generic_name: itemForm.generic_name || 'N/A',
        barcode: finalBarcode,
        category: itemForm.category,
        strip_per_box: stripPerBox,
        tablet_per_strip: tabPerStrip,
        total_tablets: totalTabs,
        reorder_level: parseInt(itemForm.reorder_level) || 0,
        purchase_price: purchasePrice,
        selling_price_per_tab: sellingPrice,
        expiry_date: itemForm.expiry_date,
        batches: [
          {
            batchNumber: itemForm.batchNumber || `B-${Date.now().toString().slice(-4)}`,
            expiryDate: itemForm.expiry_date,
            costPrice: calculatedCost,
            quantityOnHand: totalTabs
          }
        ]
      };

      await db.save('inventory', newItem);
      setShowItemModal(false);
      setItemForm({
        name: '',
        generic_name: '',
        barcode: '',
        category: 'Tablet',
        strip_per_box: '10',
        tablet_per_strip: '10',
        total_tablets: '0',
        reorder_level: '20',
        purchase_price: '',
        selling_price_per_tab: '',
        expiry_date: '',
        batchNumber: ''
      });
      loadInventory();
      alert('Inventory item saved.');
    } catch (e) {
      console.error(e);
    }
  };

  const openRestock = (item) => {
    setSelectedItem(item);
    setRestockForm({ 
      unitType: 'box', 
      quantity: '',
      batchNumber: `B-${Date.now().toString().slice(-4)}`,
      expiryDate: item.expiry_date,
      costPrice: ''
    });
    setShowRestockModal(true);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    const qty = parseInt(restockForm.quantity);
    if (!qty || qty <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    try {
      const stripPerBox = Number(selectedItem.strip_per_box) || 1;
      const tabPerStrip = Number(selectedItem.tablet_per_strip) || 1;
      let tabsToAdd = 0;

      if (restockForm.unitType === 'box') {
        tabsToAdd = qty * stripPerBox * tabPerStrip;
      } else if (restockForm.unitType === 'strip') {
        tabsToAdd = qty * tabPerStrip;
      } else {
        tabsToAdd = qty;
      }

      // Cost price calculation per tablet for this batch
      const customCost = parseFloat(restockForm.costPrice) || 0;
      let calculatedCost = 0;
      if (customCost > 0) {
        if (restockForm.unitType === 'box') {
          calculatedCost = customCost / (stripPerBox * tabPerStrip);
        } else if (restockForm.unitType === 'strip') {
          calculatedCost = customCost / tabPerStrip;
        } else {
          calculatedCost = customCost;
        }
      } else {
        calculatedCost = (parseFloat(selectedItem.selling_price_per_tab) || 0) * 0.6; // 60% fallback
      }

      const newBatch = {
        batchNumber: restockForm.batchNumber || `B-${Date.now().toString().slice(-4)}`,
        expiryDate: restockForm.expiryDate || selectedItem.expiry_date,
        costPrice: calculatedCost,
        quantityOnHand: tabsToAdd
      };

      // Append and sort batches by expiry date (FEFO)
      const currentBatches = selectedItem.batches || [];
      const updatedBatches = [...currentBatches, newBatch];
      updatedBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      // Use closest expiry of available batches as the main item expiry date
      const closestExpiry = updatedBatches.length > 0 ? updatedBatches[0].expiryDate : selectedItem.expiry_date;

      const updatedItem = {
        ...selectedItem,
        total_tablets: (Number(selectedItem.total_tablets) || 0) + tabsToAdd,
        expiry_date: closestExpiry,
        batches: updatedBatches
      };

      await db.save('inventory', updatedItem);
      setShowRestockModal(false);
      setSelectedItem(null);
      loadInventory();
      alert(`Restocked ${qty} ${restockForm.unitType}(s). Batch records updated.`);
    } catch (err) {
      console.error(err);
    }
  };

  // Barcode simulation: typing barcode search mimics hardware scan
  const handleBarcodeScanInput = (val) => {
    setBarcodeSearch(val);
    const matched = inventory.find(i => i.barcode === val);
    if (matched) {
      // Auto highlight/view item details or open restock
      openRestock(matched);
      setBarcodeSearch('');
    }
  };

  // Filter items by name or barcode
  const filteredInventory = inventory.filter(item => {
    const term = searchTerm.toLowerCase();
    return item.name.toLowerCase().includes(term) || 
           item.generic_name.toLowerCase().includes(term) || 
           item.barcode.includes(term);
  });

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Pharmacy Stock & Inventory</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage packaging conversions, review expiry dates, and print barcodes</p>
        </div>
        <button onClick={() => setShowItemModal(true)} className="btn btn-primary">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ width: '18px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Add Product / Drug
        </button>
      </header>

      {/* Barcode scanner mimic and Search toolbar */}
      <div className="glass-card flex-wrap-safe no-print" style={{ marginBottom: '1.5rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
          <input 
            type="text" 
            placeholder="Search by Medicine/Generic name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 2 }}
          />
          <input 
            type="text" 
            placeholder="Scan Barcode (mimic field)..." 
            value={barcodeSearch}
            onChange={(e) => handleBarcodeScanInput(e.target.value)}
            style={{ flex: 1, borderColor: 'var(--primary)' }}
          />
        </div>
      </div>

      {/* Inventory table */}
      <div className="glass-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Medicine Stock Listing</h2>
        
        <div className="table-container">
          {filteredInventory.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No inventory entries logged.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Drug Details</th>
                  <th>Packaging Configuration</th>
                  <th>Total Tablets (Base)</th>
                  <th>Converted Stock Layout</th>
                  <th>Expiry Date</th>
                  <th>Retail Price</th>
                  <th className="no-print">Stock Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const pkg = formatPackagingStock(item);
                  const isExpiring = item.expiry_date <= threeMonthsFromNow;
                  const isLowStock = Number(item.total_tablets) <= Number(item.reorder_level);

                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gen: {item.generic_name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Barcode: {item.barcode}</div>
                        {/* Batches details display */}
                        {item.batches && item.batches.length > 0 && (
                          <div style={{ fontSize: '0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                            {item.batches.map((b, bIdx) => (
                              <span key={bIdx} style={{ background: 'var(--bg-app)', padding: '1px 4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                {b.batchNumber}: {b.quantityOnHand}u (exp {b.expiryDate.split('-')[0]})
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem' }}>
                          1 Box = {item.strip_per_box} Str × {item.tablet_per_strip} Tab ({pkg.tabsPerBox} total)
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: '600', color: isLowStock ? 'var(--danger)' : 'inherit' }}>
                          {item.total_tablets} units
                        </span>
                        {isLowStock && <span className="badge badge-danger" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>LOW</span>}
                      </td>
                      <td>
                        <strong style={{ color: 'var(--primary)' }}>
                          {pkg.box} Box, {pkg.strip} Str, {pkg.tab} Tab
                        </strong>
                      </td>
                      <td>
                        <span style={{ color: isExpiring ? 'var(--danger)' : 'inherit', fontWeight: isExpiring ? 'bold' : 'normal' }}>
                          {item.expiry_date}
                        </span>
                        {isExpiring && <span className="badge badge-pending" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>EXPIRY RISK</span>}
                      </td>
                      <td>{item.selling_price_per_tab} Ks / tab</td>
                      <td className="no-print">
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button 
                            onClick={() => openRestock(item)} 
                            className="btn btn-success"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '30px' }}
                          >
                            + Restock
                          </button>
                          <button 
                            onClick={() => setBarcodePrintItem(item)}
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', minHeight: '30px' }}
                          >
                            🏷️ Barcode
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add New Product Modal */}
      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>Add Product to Inventory</h3>
              <button className="mobile-menu-btn" onClick={() => setShowItemModal(false)} style={{ color: 'var(--text-primary)' }}>✕</button>
            </div>
            
            <form onSubmit={handleSaveItem}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Product / Trade Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Paracetamol 500mg"
                      value={itemForm.name}
                      onChange={e => setItemForm({...itemForm, name: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Generic Chemical Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Acetaminophen"
                      value={itemForm.generic_name}
                      onChange={e => setItemForm({...itemForm, generic_name: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Barcode / SKU (Leave blank to auto-generate)</label>
                    <input 
                      type="text" 
                      placeholder="Scan or type barcode"
                      value={itemForm.barcode}
                      onChange={e => setItemForm({...itemForm, barcode: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Formulation Category</label>
                    <select value={itemForm.category} onChange={e => setItemForm({...itemForm, category: e.target.value})}>
                      <option>Tablet</option><option>Capsule</option>
                      <option>Syrup (ml)</option><option>Injection (Vial)</option>
                      <option>Cream (Tube)</option>
                    </select>
                  </div>
                </div>

                {/* Packaging calculation definitions */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-app)' }}>
                  <h4 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: 'var(--primary)' }}>Unit Conversion Setup</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Strips in a Box *</label>
                      <input 
                        type="number" 
                        required 
                        value={itemForm.strip_per_box}
                        onChange={e => setItemForm({...itemForm, strip_per_box: e.target.value})}
                      />
                    </div>
                    <div className="form-group">
                      <label>Tablets in a Strip *</label>
                      <input 
                        type="number" 
                        required 
                        value={itemForm.tablet_per_strip}
                        onChange={e => setItemForm({...itemForm, tablet_per_strip: e.target.value})}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.5rem' }}>
                    * E.g. If box contains 10 strips, and each strip contains 10 tablets, purchase conversion resolves to 100 tablets.
                  </span>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Initial Stock (Base units) *</label>
                    <input 
                      type="number" 
                      required 
                      placeholder="e.g. 100 (tablets)"
                      value={itemForm.total_tablets}
                      onChange={e => setItemForm({...itemForm, total_tablets: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reorder Alert Threshold *</label>
                    <input 
                      type="number" 
                      required 
                      value={itemForm.reorder_level}
                      onChange={e => setItemForm({...itemForm, reorder_level: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Purchase Price per Box (Ks)</label>
                    <input 
                      type="number" 
                      placeholder="Cost price"
                      value={itemForm.purchase_price}
                      onChange={e => setItemForm({...itemForm, purchase_price: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Selling Price per TABLET (Ks) *</label>
                    <input 
                      type="number" 
                      required 
                      placeholder="Retail price"
                      value={itemForm.selling_price_per_tab}
                      onChange={e => setItemForm({...itemForm, selling_price_per_tab: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Batch Number *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. B-PARA-01"
                      value={itemForm.batchNumber}
                      onChange={e => setItemForm({...itemForm, batchNumber: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Expiry Date *</label>
                    <input 
                      type="date" 
                      required 
                      value={itemForm.expiry_date}
                      onChange={e => setItemForm({...itemForm, expiry_date: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowItemModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Increment Modal */}
      {showRestockModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Restock Product</h3>
              <button className="mobile-menu-btn" onClick={() => setShowRestockModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleRestockSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: 'var(--primary-light)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.85rem' }}>
                  Restocking: <strong>{selectedItem.name}</strong>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Select Unit Type</label>
                    <select 
                      value={restockForm.unitType}
                      onChange={e => setRestockForm({...restockForm, unitType: e.target.value})}
                    >
                      <option value="box">Box (of {Number(selectedItem.strip_per_box) * Number(selectedItem.tablet_per_strip)} units)</option>
                      <option value="strip">Strip (of {selectedItem.tablet_per_strip} units)</option>
                      <option value="tablet">Tablet / Base Unit</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Restock Quantity *</label>
                    <input 
                      type="number" 
                      required
                      placeholder="e.g. 5"
                      value={restockForm.quantity}
                      onChange={e => setRestockForm({...restockForm, quantity: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Batch Number *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. B-PARA-02"
                      value={restockForm.batchNumber}
                      onChange={e => setRestockForm({...restockForm, batchNumber: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Batch Expiry Date *</label>
                    <input 
                      type="date" 
                      required
                      value={restockForm.expiryDate}
                      onChange={e => setRestockForm({...restockForm, expiryDate: e.target.value})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Cost Price for Selected Unit (Ks)</label>
                  <input 
                    type="number" 
                    placeholder="Purchase cost for restock qty"
                    value={restockForm.costPrice}
                    onChange={e => setRestockForm({...restockForm, costPrice: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowRestockModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-success">Update Stock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Barcode Label Sheet Modal */}
      {barcodePrintItem && (
        <div className="modal-overlay no-print">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3>Product Barcode Label Printer</h3>
              <button className="mobile-menu-btn" onClick={() => setBarcodePrintItem(null)}>✕</button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Form Layout options */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-app)', padding: '1rem', borderRadius: '10px' }}>
                <div className="form-group">
                  <label>Select Printer Layout</label>
                  <select value={printMode} onChange={e => setPrintMode(e.target.value)}>
                    <option value="thermal">Single Label (Thermal Roll)</option>
                    <option value="a4_grid">A4 Sticker Sheet (Grid)</option>
                  </select>
                </div>
                {printMode === 'a4_grid' && (
                  <>
                    <div className="form-group">
                      <label>Grid Columns (A4 Page)</label>
                      <select value={gridCols} onChange={e => setGridCols(parseInt(e.target.value))}>
                        <option value={2}>2 Columns (Wide)</option>
                        <option value={3}>3 Columns (Standard)</option>
                        <option value={4}>4 Columns (Compact)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label>Stickers to Print (Quantity)</label>
                      <input 
                        type="number" 
                        value={gridCount} 
                        onChange={e => setGridCount(Math.max(1, parseInt(e.target.value) || 1))} 
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Preview segment */}
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Live Layout Preview:</h4>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'var(--bg-surface-solid)', maxHeight: '200px', overflowY: 'auto' }}>
                  {printMode === 'thermal' ? (
                    <div style={{ border: '1px solid #ccc', padding: '1rem', borderRadius: '8px', background: '#fff', color: '#000', maxWidth: '250px', margin: '0 auto', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{barcodePrintItem.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#555', marginBottom: '0.25rem' }}>Gen: {barcodePrintItem.generic_name}</div>
                      {generateCode39Svg(barcodePrintItem.barcode)}
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', letterSpacing: '0.05em' }}>{barcodePrintItem.barcode}</div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                      gap: '0.5rem',
                      background: '#fff',
                      padding: '0.5rem'
                    }}>
                      {Array.from({ length: Math.min(12, gridCount) }).map((_, idx) => (
                        <div key={idx} style={{ border: '1px dashed #777', padding: '0.5rem', textAlign: 'center', background: '#fff', color: '#000' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{barcodePrintItem.name}</div>
                          <div style={{ fontSize: '0.55rem', color: '#555' }}>Gen: {barcodePrintItem.generic_name}</div>
                          {generateCode39Svg(barcodePrintItem.barcode)}
                          <div style={{ fontSize: '0.55rem', marginTop: '2px' }}>{barcodePrintItem.barcode}</div>
                        </div>
                      ))}
                      {gridCount > 12 && (
                        <div style={{ gridColumn: `span ${gridCols}`, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.5rem' }}>
                          + showing first 12 preview labels ({gridCount} total to print)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={() => setBarcodePrintItem(null)} className="btn btn-secondary">Close</button>
              <button onClick={() => {
                if (window.AndroidPrintBridge && typeof window.AndroidPrintBridge.printPage === 'function') {
                  window.AndroidPrintBridge.printPage();
                } else {
                  window.print();
                }
              }} className="btn btn-primary">Print / Save PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden print page block specifically rendered for `@media print` */}
      {barcodePrintItem && (
        printMode === 'thermal' ? (
          <div className="only-print print-area">
            <div className="id-card-print" style={{
              width: '85.6mm',
              height: '53.98mm',
              border: '1px solid #000',
              borderRadius: '6px',
              padding: '10px',
              fontFamily: 'monospace',
              color: '#000',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#fff'
            }}>
              <div style={{ fontSize: '10pt', fontWeight: 'bold', marginBottom: '2px' }}>{barcodePrintItem.name}</div>
              <div style={{ fontSize: '8pt', color: '#444', marginBottom: '4px' }}>Gen: {barcodePrintItem.generic_name}</div>
              {generateCode39Svg(barcodePrintItem.barcode)}
              <div style={{ fontSize: '8pt', marginTop: '2px', letterSpacing: '0.05em' }}>{barcodePrintItem.barcode}</div>
            </div>
          </div>
        ) : (
          <div className={`only-print print-area barcode-grid-sheet cols-${gridCols}`}>
            {Array.from({ length: gridCount }).map((_, idx) => (
              <div key={idx} className="barcode-sticker-card">
                <div style={{ fontSize: '9pt', fontWeight: 'bold', textTransform: 'uppercase' }}>{barcodePrintItem.name}</div>
                <div style={{ fontSize: '7pt', color: '#444', marginBottom: '3px' }}>Gen: {barcodePrintItem.generic_name}</div>
                {generateCode39Svg(barcodePrintItem.barcode)}
                <div style={{ fontSize: '7.5pt', marginTop: '2px', letterSpacing: '0.05em' }}>{barcodePrintItem.barcode}</div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
