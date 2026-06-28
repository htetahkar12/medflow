import React, { useState, useEffect } from 'react';
import { db } from '../db/IndexedDB';
import { syncManager } from '../db/SyncManager';

const RenderRevenueLineChart = ({ data }) => {
  const width = 500;
  const height = 180;
  const paddingLeft = 50;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const maxVal = Math.max(...data, 500000);
  const days = data.length || 30;

  // Generate coordinates
  const points = data.map((val, idx) => {
    const x = paddingLeft + (idx / (days - 1)) * (width - paddingLeft - paddingRight);
    const y = height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom);
    return { x, y, val, day: idx + 1 };
  });

  const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z` 
    : '';

  // Y ticks
  const yTicks = [0, maxVal / 2, maxVal];

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>📈 Daily Revenue Trend (Line Graph)</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peak: {Math.round(maxVal).toLocaleString()} Ks</span>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '400px', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          
          {/* Horizontal grid lines */}
          {yTicks.map((tick, idx) => {
            const y = height - paddingBottom - (tick / maxVal) * (height - paddingTop - paddingBottom);
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="rgba(255, 255, 255, 0.05)" 
                  strokeDasharray="4 4"
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  fill="var(--text-secondary)" 
                  style={{ fontSize: '9px', fontFamily: 'monospace' }}
                >
                  {Math.round(tick).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaPath && <path d={areaPath} fill="url(#revGrad)" />}

          {/* Sparkline path */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="var(--primary)" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Interactive dots */}
          {points.map((p, idx) => (
            p.val > 0 && (
              <circle 
                key={idx} 
                cx={p.x} 
                cy={p.y} 
                r="3" 
                fill="var(--primary)" 
                stroke="#fff" 
                strokeWidth="1"
                style={{ cursor: 'pointer' }}
              >
                <title>Day {p.day}: {p.val.toLocaleString()} Ks</title>
              </circle>
            )
          ))}

          {/* X Axis ticks */}
          {points.filter((_, idx) => idx % 5 === 0 || idx === days - 1).map((p, idx) => (
            <text 
              key={idx} 
              x={p.x} 
              y={height - 8} 
              textAnchor="middle" 
              fill="var(--text-secondary)" 
              style={{ fontSize: '9px' }}
            >
              D{p.day}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};

const RenderVisitsBarChart = ({ data }) => {
  const width = 500;
  const height = 180;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 25;

  const maxVal = Math.max(...data, 30);
  const days = data.length || 30;

  const colWidth = (width - paddingLeft - paddingRight) / days;
  const barWidth = Math.max(2, colWidth - 3);

  // Y ticks
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>📊 Daily Patient Visits (Bar Graph)</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peak: {maxVal} visits</span>
      </div>
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', minWidth: '400px', height: '100%', overflow: 'visible' }}>
          
          {/* Horizontal grid lines */}
          {yTicks.map((tick, idx) => {
            const y = height - paddingBottom - (tick / maxVal) * (height - paddingTop - paddingBottom);
            return (
              <g key={idx}>
                <line 
                  x1={paddingLeft} 
                  y1={y} 
                  x2={width - paddingRight} 
                  y2={y} 
                  stroke="rgba(255, 255, 255, 0.05)" 
                  strokeDasharray="4 4"
                />
                <text 
                  x={paddingLeft - 8} 
                  y={y + 4} 
                  textAnchor="end" 
                  fill="var(--text-secondary)" 
                  style={{ fontSize: '9px', fontFamily: 'monospace' }}
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Bar Rects */}
          {data.map((val, idx) => {
            const x = paddingLeft + idx * colWidth + 1.5;
            const y = height - paddingBottom - (val / maxVal) * (height - paddingTop - paddingBottom);
            const barHeight = height - paddingBottom - y;
            
            return (
              <g key={idx}>
                <rect 
                  x={x} 
                  y={y} 
                  width={barWidth} 
                  height={Math.max(0.5, barHeight)} 
                  rx="1.5" 
                  ry="1.5"
                  fill={val > 0 ? 'var(--accent)' : 'rgba(255, 255, 255, 0.03)'}
                  style={{ transition: 'all 0.3s ease' }}
                >
                  <title>Day {idx + 1}: {val} patient(s)</title>
                </rect>
              </g>
            );
          })}

          {/* X Axis ticks */}
          {data.filter((_, idx) => idx % 5 === 0 || idx === days - 1).map((_, idx) => {
            const dayIdx = idx * 5 === days ? days - 1 : idx * 5;
            const x = paddingLeft + dayIdx * colWidth + barWidth / 2;
            return (
              <text 
                key={idx} 
                x={x} 
                y={height - 8} 
                textAnchor="middle" 
                fill="var(--text-secondary)" 
                style={{ fontSize: '9px' }}
              >
                D{dayIdx + 1}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default function Reports() {
  const [expenses, setExpenses] = useState([]);
  const [sales, setSales] = useState([]);
  const [consultations, setConsultations] = useState([]);
  
  // Month selector
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
  });

  // Expense Form State
  const [expForm, setExpForm] = useState({
    category: 'Rent',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Financial States
  const [financeSummary, setFinanceSummary] = useState({
    totalIncome: 0,
    totalCOGS: 0,
    grossProfit: 0,
    totalPayouts: 0,
    totalExpenses: 0,
    netProfit: 0
  });

  const [doctorPayoutsList, setDoctorPayoutsList] = useState([]);

  // Clinical Statistics States
  const [diseaseDistribution, setDiseaseDistribution] = useState([]);
  const [doctorVisits, setDoctorVisits] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [dailyVisits, setDailyVisits] = useState([]);

  useEffect(() => {
    loadReportData();
  }, [selectedMonth]);

  const loadReportData = async () => {
    try {
      const clinicId = syncManager.getClinicId();
      const allExpenses = await db.getAll('expenses');
      const allSales = await db.getAll('sales');
      const allConsults = await db.getAll('consultations');
      const allDoctors = await db.getAll('doctors');

      // Filter by selected month: YYYY-MM
      const filteredExpenses = allExpenses.filter(e => e.date.startsWith(selectedMonth) && e.clinic_id === clinicId);
      const filteredSales = allSales.filter(s => s.timestamp.startsWith(selectedMonth) && s.clinic_id === clinicId);
      const filteredConsults = allConsults.filter(c => c.timestamp.startsWith(selectedMonth) && c.clinic_id === clinicId);

      setExpenses(filteredExpenses);
      setSales(filteredSales);
      setConsultations(filteredConsults);

      // 1. Calculate financials
      const totalIncome = filteredSales.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
      const totalExpenses = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      
      // Calculate Cost of Goods Sold (COGS)
      let totalCOGS = 0;
      filteredSales.forEach(s => {
        if (s.items) {
          s.items.forEach(item => {
            totalCOGS += Number(item.totalCostPrice) || 0;
          });
        }
      });

      const grossProfit = totalIncome - totalCOGS;

      // Calculate Doctor Payouts
      let totalDoctorPayouts = 0;
      const payoutsList = allDoctors
        .filter(d => d.clinic_id === clinicId)
        .map(doc => {
          // Find sales credited to this doctor
          const docSales = filteredSales.filter(s => s.doctor_id === doc.id);
          const totalBilled = docSales.reduce((acc, curr) => acc + (Number(curr.doctorFee) || 0), 0);
          const patientCount = docSales.length;

          let payout = 0;
          if (doc.paymentType === 'percentage') {
            payout = totalBilled * ((Number(doc.paymentValue) || 0) / 100);
          } else if (doc.paymentType === 'flat') {
            payout = patientCount * (Number(doc.paymentValue) || 0);
          } else {
            payout = patientCount * 4000; // fallback standard commission
          }

          totalDoctorPayouts += payout;

          return {
            id: doc.id,
            name: doc.name,
            specialty: doc.specialty,
            totalBilled,
            patientCount,
            calculatedPayout: payout
          };
        });

      setDoctorPayoutsList(payoutsList);

      const netProfit = grossProfit - totalDoctorPayouts - totalExpenses;

      setFinanceSummary({
        totalIncome,
        totalCOGS,
        grossProfit,
        totalPayouts: totalDoctorPayouts,
        totalExpenses,
        netProfit
      });

      // 2. Calculate top diagnoses distribution
      const diagnosesCounts = {};
      filteredConsults.forEach(c => {
        const diag = c.diagnosis ? c.diagnosis.trim() : 'Unknown';
        diagnosesCounts[diag] = (diagnosesCounts[diag] || 0) + 1;
      });

      const diseaseList = Object.keys(diagnosesCounts).map(name => ({
        name,
        count: diagnosesCounts[name]
      }));
      
      // Sort and slice top 5
      diseaseList.sort((a, b) => b.count - a.count);
      setDiseaseDistribution(diseaseList.slice(0, 5));

      // 3. Calculate doctor patient workload
      const docCounts = {};
      filteredConsults.forEach(c => {
        docCounts[c.doctor_id] = (docCounts[c.doctor_id] || 0) + 1;
      });

      const doctorWorkload = allDoctors
        .filter(d => d.clinic_id === clinicId)
        .map(d => ({
          name: d.name,
          count: docCounts[d.id] || 0
        }));
      setDoctorVisits(doctorWorkload);

      // 4. Calculate daily revenue and visits trends
      const getDaysInMonth = (monthStr) => {
        const parts = monthStr.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        return new Date(y, m, 0).getDate();
      };
      
      const daysCount = getDaysInMonth(selectedMonth);
      const revenueTrend = Array(daysCount).fill(0);
      const visitsTrend = Array(daysCount).fill(0);

      filteredSales.forEach(s => {
        const d = new Date(s.timestamp).getDate();
        if (d >= 1 && d <= daysCount) {
          revenueTrend[d - 1] += Number(s.total) || 0;
        }
      });

      filteredConsults.forEach(c => {
        const d = new Date(c.timestamp).getDate();
        if (d >= 1 && d <= daysCount) {
          visitsTrend[d - 1] += 1;
        }
      });

      setDailyRevenue(revenueTrend);
      setDailyVisits(visitsTrend);

    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expForm.amount || !expForm.description) {
      alert('Please fill out expense amount and description.');
      return;
    }

    try {
      const clinicId = syncManager.getClinicId();
      const expenseId = `EXP-${Date.now()}`;

      const newExpense = {
        id: expenseId,
        clinic_id: clinicId,
        category: expForm.category,
        amount: parseFloat(expForm.amount),
        description: expForm.description,
        date: expForm.date
      };

      await db.save('expenses', newExpense);
      setExpForm({
        category: 'Rent',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      loadReportData();
      alert('Expense recorded successfully.');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    await db.delete('expenses', id);
    loadReportData();
  };

  return (
    <div>
      <header className="flex-wrap-safe no-print" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Financial & Medical Statistics</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track operational expenses, review cashflow balance, and analyze monthly disease statistics</p>
        </div>
        
        {/* Month Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ margin: 0 }}>Select Month:</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ width: 'auto', minHeight: '38px', padding: '0.5rem 1rem' }}
          />
        </div>
      </header>

      {/* Financial Overview Cards */}
      <div className="dashboard-stats-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '2.5rem' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>TOTAL REVENUE</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {financeSummary.totalIncome.toLocaleString()} Ks
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>COST OF GOODS (COGS)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {financeSummary.totalCOGS.toLocaleString()} Ks
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>GROSS PROFIT</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem', color: 'var(--primary)' }}>
            {financeSummary.grossProfit.toLocaleString()} Ks
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #a855f7', padding: '1rem' }}> {/* Purple */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>DOCTOR PAYOUTS</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {financeSummary.totalPayouts.toLocaleString()} Ks
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', padding: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>OTHER EXPENSES</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem' }}>
            {financeSummary.totalExpenses.toLocaleString()} Ks
          </div>
        </div>

        <div className="glass-card" style={{ 
          background: financeSummary.netProfit >= 0 ? 'var(--accent-light)' : 'var(--danger-light)', 
          borderLeft: `4px solid ${financeSummary.netProfit >= 0 ? 'var(--accent)' : 'var(--danger)'}`,
          padding: '1rem' 
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>NET PROFIT</div>
          <div style={{ 
            fontSize: '1.25rem', 
            fontWeight: '800', 
            marginTop: '0.25rem',
            color: financeSummary.netProfit >= 0 ? 'var(--accent)' : 'var(--danger)' 
          }}>
            {financeSummary.netProfit.toLocaleString()} Ks
          </div>
        </div>
      </div>

      {/* Graphical Visualizations Grid */}
      <div className="responsive-card-grid no-print" style={{ marginBottom: '2.5rem' }}>
        <RenderRevenueLineChart data={dailyRevenue} />
        <RenderVisitsBarChart data={dailyVisits} />
      </div>

      {/* Main Charts & Expenses Row */}
      <div className="responsive-card-grid no-print">
        
        {/* Expense logger */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Record Expense</h2>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={expForm.category} onChange={e => setExpForm({...expForm, category: e.target.value})}>
                  <option>Rent</option>
                  <option>Staff Salary</option>
                  <option>Electricity & Water</option>
                  <option>Medical Supplies</option>
                  <option>Logistics & Transport</option>
                  <option>Other Operational Costs</option>
                </select>
              </div>
              <div className="form-group">
                <label>Amount (Ks) *</label>
                <input 
                  type="number" 
                  required
                  placeholder="Ks"
                  value={expForm.amount}
                  onChange={e => setExpForm({...expForm, amount: e.target.value})}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Description *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Paid office rent for June"
                  value={expForm.description}
                  onChange={e => setExpForm({...expForm, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input 
                  type="date" 
                  required
                  value={expForm.date}
                  onChange={e => setExpForm({...expForm, date: e.target.value})}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-danger" style={{ alignSelf: 'flex-end' }}>
              Save Expense
            </button>
          </form>

          {/* Expenses List */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Monthly Expense Log</h3>
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {expenses.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No expenses logged for this month.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {expenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', padding: '0.5rem', background: 'var(--bg-app)', borderRadius: '6px', fontSize: '0.85rem', alignItems: 'center' }}>
                      <div>
                        <strong>{e.category}</strong> - <span style={{ color: 'var(--text-secondary)' }}>{e.description}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{e.date}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>-{e.amount.toLocaleString()} Ks</span>
                        <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Clinical stats (Disease prevalence graph via custom SVG responsive bars) */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Top Diagnosed Illnesses (Monthly Prevalence)</h2>
          {diseaseDistribution.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No diagnoses logged for this month. Finalize consultations to generate trends.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {diseaseDistribution.map((disease, index) => {
                const maxCount = Math.max(...diseaseDistribution.map(d => d.count)) || 1;
                const percentage = (disease.count / maxCount) * 100;
                
                // Colors list for visual appeal
                const colors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                const barColor = colors[index % colors.length];

                return (
                  <div key={disease.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                      <span>{disease.name}</span>
                      <strong style={{ color: barColor }}>{disease.count} patient(s)</strong>
                    </div>
                    {/* SVG horizontal rounded pill bar chart */}
                    <div style={{ background: 'var(--bg-app)', height: '14px', borderRadius: '7px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ 
                        width: `${percentage}%`, 
                        backgroundColor: barColor, 
                        height: '100%', 
                        borderRadius: '7px',
                        transition: 'width 1s ease-in-out'
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Practitioner performance workload & payout charts */}
      <div className="responsive-card-grid no-print" style={{ marginTop: '1.5rem' }}>
        
        {/* Doctor Workload */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1rem' }}>Doctor Patient Workload</h2>
          {doctorVisits.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No practitioner logs matching this month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {doctorVisits.map(doc => (
                <div key={doc.name} style={{ background: 'var(--bg-app)', padding: '0.75rem 1rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{doc.name}</strong>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>{doc.count} patient(s)</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doctor Payout summary report */}
        <div className="glass-card">
          <h2 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1rem' }}>Doctor Payout Statements</h2>
          <div className="table-container" style={{ margin: 0 }}>
            <table style={{ minWidth: 'auto', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Doctor Name</th>
                  <th>Total Billed</th>
                  <th>Calculated Payout</th>
                </tr>
              </thead>
              <tbody>
                {doctorPayoutsList.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div style={{ fontWeight: '600' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doc.specialty}</div>
                    </td>
                    <td>{doc.totalBilled.toLocaleString()} Ks</td>
                    <td style={{ fontWeight: '700', color: 'var(--primary)' }}>{doc.calculatedPayout.toLocaleString()} Ks</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
