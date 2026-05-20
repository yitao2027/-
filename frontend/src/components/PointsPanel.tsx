import { useState, useEffect } from 'react';
import { useStore } from '../store';
import {
  getMembershipPlans, createOrder, markOrderPaid,
  getOrders, getTransactions,
} from '../services/pointsApi';

export default function PointsPanel() {
  const { pointsBalance, refreshPointsBalance, isPointsLoggedIn } = useStore();

  // 套餐
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // 订单弹窗
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [payerAccount, setPayerAccount] = useState('');
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // 订单列表
  const [orders, setOrders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'orders' | 'transactions'>('plans');

  // 加载套餐
  useEffect(() => {
    if (!isPointsLoggedIn) return;
    getMembershipPlans().then(setPlans).catch(() => {}).finally(() => setPlansLoading(false));
  }, [isPointsLoggedIn]);

  const handleCreateOrder = async (planId: string) => {
    try {
      setOrderSubmitting(true);
      const order = await createOrder(planId);
      setCurrentOrder(order);
      setShowOrderModal(true);
    } catch (e: any) {
      alert(`创建订单失败: ${e.message}`);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!currentOrder || !payerAccount.trim()) { alert('请输入付款账号后4位'); return; }
    try {
      await markOrderPaid(currentOrder.id, payerAccount);
      setShowOrderModal(false);
      setCurrentOrder(null);
      setPayerAccount('');
      refreshPointsBalance();
      alert('已提交，等待管理员确认');
    } catch (e: any) {
      alert(`提交失败: ${e.message}`);
    }
  };

  const loadOrders = async () => {
    try {
      const res = await getOrders();
      setOrders(res.items || []);
    } catch {}
  };

  const loadTransactions = async () => {
    try {
      const res = await getTransactions();
      setTransactions(res.items || []);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'orders') loadOrders();
    if (activeTab === 'transactions') loadTransactions();
  }, [activeTab]);

  // 未登录提示
  const cardStyle = { background: '#fff', border: '1px solid #EDEDED', borderRadius: '12px' };

  if (!isPointsLoggedIn) {
    return (
      <div style={{ ...cardStyle, padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px', marginBottom: '12px' }}>💎</p>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>积分充值</p>
        <p style={{ fontSize: '13px', color: '#9CA3AF' }}>请使用手机号登录后查看积分信息</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 余额卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)',
        borderRadius: '14px', padding: '20px 24px', color: '#fff',
      }}>
        <p style={{ fontSize: '12px', opacity: 0.8, marginBottom: '4px' }}>当前积分余额</p>
        <p style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>{pointsBalance.toLocaleString()}</p>
        <p style={{ fontSize: '11px', opacity: 0.7, marginTop: '8px' }}>AI对话自动扣减积分，新用户注册赠送300积分</p>
      </div>

      {/* Tab 切换 */}
      <div style={{ display: 'flex', gap: '4px', background: '#EDEDED', borderRadius: '10px', padding: '4px', width: 'fit-content' }}>
        {([
          { id: 'plans' as const, label: '充值套餐', icon: '💎' },
          { id: 'orders' as const, label: '我的订单', icon: '📋' },
          { id: 'transactions' as const, label: '积分明细', icon: '📊' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer',
              background: activeTab === tab.id ? '#fff' : 'transparent',
              color: activeTab === tab.id ? '#111827' : '#6B7280',
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
            }}>
            <span style={{ marginRight: '4px' }}>{tab.icon}</span>{tab.label}
          </button>
        ))}
      </div>

      {/* 套餐列表 */}
      {activeTab === 'plans' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {plansLoading ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', gridColumn: '1/-1', textAlign: 'center', padding: '20px' }}>加载中...</p>
          ) : plans.filter(p => p.isActive).map(plan => (
            <div key={plan.id} style={{ ...cardStyle, padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>{plan.name}</p>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '2px' }}>{plan.description}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>¥{plan.price}</span>
                {plan.durationDays > 0 && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>/ {plan.durationDays}天</span>}
              </div>
              <p style={{ fontSize: '12px', color: '#57CC86', fontWeight: 500 }}>
                {plan.points + (plan.bonusPoints || 0)} 积分
                {plan.bonusPoints > 0 && <span style={{ color: '#F59E0B', marginLeft: '4px' }}>(含赠{plan.bonusPoints})</span>}
              </p>
              <button onClick={() => handleCreateOrder(plan.id)} disabled={orderSubmitting}
                style={{
                  marginTop: '4px', padding: '8px 0', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  border: 'none', cursor: 'pointer', color: '#fff',
                  background: 'linear-gradient(135deg, #57CC86, #3DAA5F)',
                  boxShadow: '0 2px 8px rgba(87,204,134,0.3)',
                  transition: 'all 0.2s',
                }}>
                {orderSubmitting ? '创建中...' : '立即充值'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 订单列表 */}
      {activeTab === 'orders' && (
        <div style={cardStyle}>
          {orders.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '30px' }}>暂无订单记录</p>
          ) : orders.map((order: any) => (
            <div key={order.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{order.planSnapshot?.name || '充值'}</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{order.orderNo}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>¥{order.amount}</p>
                <span style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                  background: order.status === 'PAID' ? '#DCFCE7' : order.status === 'PENDING' ? '#FEF3C7' : '#FEE2E2',
                  color: order.status === 'PAID' ? '#166534' : order.status === 'PENDING' ? '#92400E' : '#991B1B',
                }}>
                  {order.status === 'PAID' ? '已完成' : order.status === 'PENDING' ? '待确认' : '已取消'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 积分明细 */}
      {activeTab === 'transactions' && (
        <div style={cardStyle}>
          {transactions.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9CA3AF', textAlign: 'center', padding: '30px' }}>暂无积分变动记录</p>
          ) : transactions.map((tx: any) => (
            <div key={tx.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: '13px', color: '#111827' }}>{tx.description}</p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>{new Date(tx.createdAt).toLocaleString('zh-CN')}</p>
              </div>
              <span style={{
                fontSize: '14px', fontWeight: 600,
                color: tx.amount >= 0 ? '#059669' : '#DC2626',
              }}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 订单弹窗 */}
      {showOrderModal && currentOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowOrderModal(false)}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '28px', maxWidth: '380px', width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '16px' }}>订单支付</h3>

            <div style={{ background: '#F9FAFB', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>订单号</span>
                <span style={{ fontSize: '12px', color: '#111827', fontFamily: 'monospace' }}>{currentOrder.orderNo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>金额</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>¥{currentOrder.amount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>获得积分</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#57CC86' }}>{currentOrder.points}</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>请使用银行APP扫码支付：</p>
              <div style={{
                background: '#F3F4F6', borderRadius: '10px', padding: '12px',
                textAlign: 'center', fontSize: '12px', color: '#4B5563', lineHeight: '1.6',
              }}>
                <p style={{ fontWeight: 600, marginBottom: '4px' }}>中信银行北京万柳支行</p>
                <p style={{ fontFamily: 'monospace', fontSize: '13px', letterSpacing: '1px' }}>8110 7010 1360 3336 558</p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', color: '#6B7280', display: 'block', marginBottom: '6px' }}>付款账号后4位（核实用）</label>
              <input value={payerAccount} onChange={e => setPayerAccount(e.target.value)}
                maxLength={4} placeholder="如：8888"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px',
                  border: '1px solid #D1D5DB', fontSize: '13px', outline: 'none',
                  fontFamily: 'monospace', letterSpacing: '2px',
                }} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowOrderModal(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', fontSize: '13px', cursor: 'pointer', color: '#6B7280' }}>
                取消
              </button>
              <button onClick={handleMarkPaid} disabled={!payerAccount.trim()}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: payerAccount.trim() ? 'linear-gradient(135deg, #57CC86, #3DAA5F)' : '#D1D5DB',
                  color: '#fff', fontSize: '13px', fontWeight: 600, cursor: payerAccount.trim() ? 'pointer' : 'not-allowed',
                }}>
                我已付款
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
