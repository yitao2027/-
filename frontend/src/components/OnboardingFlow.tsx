import { useState, useEffect } from 'react';
import { useStore, type UserProfile } from '../store';
import { Sparkles, ChevronRight, ChevronLeft, MapPin, Store, Users, Briefcase, Target, ChefHat, RotateCcw } from 'lucide-react';

interface Props {
  onComplete: () => void;
  editMode?: boolean;  // true=从个人中心进入编辑模式
}

const STEPS = [
  {
    key: 'userName',
    question: '你想让我怎么称呼你？',
    sub: '我会用这个名字跟你交流',
    placeholder: '比如：涛哥、老王、李总……',
    icon: Sparkles,
    type: 'text',
    required: true,
  },
  {
    key: 'brandName',
    question: '你的品牌叫什么名字？',
    sub: '可以是已有的品牌名，或你想做的品牌名',
    placeholder: '比如：湘辣辣、粤点楼、研食社……',
    icon: Store,
    type: 'text',
    required: true,
  },
  {
    key: 'brandStatus',
    question: '你的品牌现在是什么状态？',
    sub: '这决定了我给你的建议方向',
    icon: Target,
    type: 'choice',
    options: [
      { value: 'planning', label: '🗺️ 还在策划，还没开业' },
      { value: 'running', label: '🏪 已经开业，正在经营' },
    ],
    required: true,
  },
  {
    key: 'category',
    question: '你的品牌属于哪个品类？',
    sub: '选最接近的那个',
    icon: ChefHat,
    type: 'choice',
    options: [
      { value: '快餐', label: '🍔 快餐（麦当劳式，快速出品）' },
      { value: '火锅', label: '🍲 火锅（围餐、自助、麻辣）' },
      { value: '茶饮', label: '🧋 茶饮（奶茶、果茶、咖啡）' },
      { value: '烧烤', label: '🔥 烧烤（烤肉、烤串、融合）' },
      { value: '烘焙', label: '🍰 烘焙（面包、蛋糕、甜品）' },
      { value: '中餐', label: '🥢 中餐（炒菜、正餐、宴席）' },
      { value: '日料', label: '🍣 日料（寿司、刺身、拉面）' },
      { value: '西餐', label: '🥩 西餐（牛排、意面、轻食）' },
      { value: '其他', label: '🏷️ 其他品类' },
    ],
    required: true,
  },
  {
    key: 'region',
    question: '你的门店主要分布在哪个地区？',
    sub: '告诉我大致的区域，方便我给你精准的建议',
    placeholder: '比如：四川成都、广东深圳、全国连锁……',
    icon: MapPin,
    type: 'text',
    required: true,
  },
  {
    key: 'position',
    question: '你在品牌里是什么角色？',
    sub: '这决定了我跟你沟通的方式和侧重点',
    icon: Users,
    type: 'choice',
    options: [
      { value: '老板/创始人', label: '👑 老板 / 创始人' },
      { value: '店长', label: '🏪 店长' },
      { value: '厨师长', label: '👨‍🍳 厨师长 / 后厨负责人' },
      { value: '运营总监', label: '⚙️ 运营总监 / 经理' },
      { value: '投资人', label: '💼 投资人 / 股东' },
      { value: '其他', label: '🏷️ 其他角色' },
    ],
    required: true,
  },
  {
    key: 'competitors',
    question: '你心里有没有对标的品牌？',
    sub: '可以是行业中你欣赏的品牌，也可以是你想超越的对手（可以填"暂无"）',
    placeholder: '比如：西贝、外婆家、海底捞……',
    icon: Briefcase,
    type: 'text',
    required: false,
  },
];

export default function OnboardingFlow({ onComplete, editMode = false }: Props) {
  const { updateUserProfile, completeOnboarding, userProfile } = useStore();
  const [step, setStep] = useState(0);
  // 编辑模式时预填已有数据
  const [formData, setFormData] = useState<Partial<UserProfile>>(() => {
    if (editMode && userProfile.completed) {
      return { ...userProfile };
    }
    return {};
  });
  const [inputValue, setInputValue] = useState(() => {
    if (editMode && userProfile.completed) {
      return userProfile.userName || '';
    }
    return '';
  });

  // 编辑模式：初始化时跳到step 0但预填所有数据
  useEffect(() => {
    if (editMode && userProfile.completed) {
      setFormData({
        userName: userProfile.userName || '',
        brandName: userProfile.brandName || '',
        brandStatus: userProfile.brandStatus || '',
        category: userProfile.category || '',
        region: userProfile.region || '',
        position: userProfile.position || '',
        competitors: userProfile.competitors || '',
      });
      setInputValue(userProfile.userName || '');
    }
  }, [editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 【7】跳过全部7个问题
  const handleSkipAll = () => {
    const emptyProfile: UserProfile = {
      userName: formData.userName || '用户',
      brandName: formData.brandName || '',
      brandStatus: (formData.brandStatus as any) || 'planning',
      category: formData.category || '',
      region: formData.region || '',
      position: formData.position || '',
      competitors: formData.competitors || '',
      completed: true,
      updatedAt: new Date().toISOString(),
    };
    completeOnboarding(emptyProfile);
    onComplete();
  };

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  const handleNext = () => {
    const key = current.key as keyof UserProfile;
    const value = current.type === 'choice'
      ? (formData[key] as string)
      : inputValue.trim();

    if (current.required && !value) return;

    const updates = { ...formData, [key]: value };
    setFormData(updates);

    if (isLast) {
      // 完成：保存档案
      const profile: UserProfile = {
        userName: updates.userName || '',
        brandName: updates.brandName || '',
        brandStatus: updates.brandStatus as 'planning' | 'running' || 'planning',
        category: updates.category || '',
        region: updates.region || '',
        position: updates.position || '',
        competitors: updates.competitors || '',
        completed: true,
        updatedAt: new Date().toISOString(),
      };
      completeOnboarding(profile);
      onComplete();
    } else {
      setStep(step + 1);
      setInputValue('');
    }
  };

  const handleBack = () => {
    if (!isFirst) {
      setStep(step - 1);
      const prevKey = STEPS[step - 1].key as keyof UserProfile;
      setInputValue((formData[prevKey] as string) || '');
    }
  };

  const handleChoice = (value: string) => {
    const key = current.key as keyof UserProfile;
    setFormData({ ...formData, [key]: value });
    if (isLast) {
      const profile: UserProfile = {
        userName: formData.userName || '',
        brandName: formData.brandName || '',
        brandStatus: value as 'planning' | 'running' || 'planning',
        category: formData.category || '',
        region: formData.region || '',
        position: formData.position || '',
        competitors: formData.competitors || '',
        completed: true,
        updatedAt: new Date().toISOString(),
      };
      completeOnboarding(profile);
      onComplete();
    } else {
      setStep(step + 1);
      setInputValue('');
    }
  };

  const Icon = current.icon;
  const canProceed = current.required
    ? (current.type === 'choice' ? !!formData[current.key as keyof UserProfile] : !!inputValue.trim())
    : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-lg mx-4"
        style={{
          background: '#FFFFFF',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
        }}>

        {/* 顶部装饰条 */}
        <div className="h-1.5 rounded-t-[20px] overflow-hidden">
          <div className="h-full transition-all duration-500"
            style={{
              width: `${((step + 1) / STEPS.length) * 100}%`,
              background: 'linear-gradient(90deg, #57CC86, #FF8C00)',
            }} />
        </div>

        {/* 关闭按钮 */}
        <button
          className="absolute top-4 right-4 p-2 rounded-full transition-colors"
          style={{ color: '#9CA3AF', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F3F4F6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={onComplete}
        >
          ✕
        </button>

        {/* Skip 跳过 */}
        <div className="text-center pt-6 pb-1 px-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full"
            style={{ background: editMode ? '#EFF6FF' : '#FFF9E6', color: editMode ? '#1D4ED8' : '#1A7D4E', fontSize: '12px' }}>
            {editMode ? <RotateCcw size={12} /> : <Icon size={12} />}
            <span>{editMode ? '编辑模式' : `${step + 1} / ${STEPS.length}`}</span>
          </div>
        </div>

        {/* 【7】跳过此项按钮 / 编辑模式下显示保存 */}
        <div className="text-center pb-2 px-8">
          {editMode ? (
            <button
              onClick={() => {
                const profile: UserProfile = {
                  userName: formData.userName || userProfile.userName || '用户',
                  brandName: formData.brandName || '',
                  brandStatus: (formData.brandStatus as any) || userProfile.brandStatus || 'planning',
                  category: formData.category || '',
                  region: formData.region || '',
                  position: formData.position || '',
                  competitors: formData.competitors || '',
                  completed: true,
                  updatedAt: new Date().toISOString(),
                };
                completeOnboarding(profile);
                onComplete();
              }}
              className="px-5 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: '#57CC86',
                color: '#1A1A1A',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              💾 保存修改并返回
            </button>
          ) : (
            <button
              onClick={handleSkipAll}
              className="px-5 py-2 rounded-xl text-[12px] font-medium transition-all"
              style={{
                background: 'transparent',
                color: '#9CA3AF',
                border: '1px solid #E5E7EB',
                cursor: 'pointer',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#F3F4F6';
                e.currentTarget.style.color = '#6B7280';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#9CA3AF';
                e.currentTarget.style.borderColor = '#E5E7EB';
              }}
            >
              跳过此项（跳过全部7个问题）
            </button>
          )}
          {!editMode && <p className="mt-1.5 text-[10px]" style={{ color: '#EF4444' }}>
            做完此项任务让你的AI助手更懂你
          </p>}
        </div>

        {/* 问题区 */}
        <div className="px-8 pb-2">
          <h2 className="text-xl font-bold mb-1" style={{ color: '#1A1A1A' }}>
            {current.question}
          </h2>
          <p className="text-sm mb-6" style={{ color: '#6B7280' }}>
            {current.sub}
          </p>
        </div>

        {/* 输入区 */}
        <div className="px-8 pb-6">
          {current.type === 'text' ? (
            <input
              autoFocus
              className="w-full px-4 py-3 rounded-xl border-2 text-base transition-all outline-none"
              style={{
                borderColor: '#E5E7EB',
                color: '#1A1A1A',
                background: '#F9FAFB',
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#57CC86')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
              placeholder={current.placeholder}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && canProceed) handleNext();
              }}
            />
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {current.options?.map(opt => {
                const isSelected = formData[current.key as keyof UserProfile] === opt.value;
                return (
                  <button
                    key={opt.value}
                    className="w-full text-left px-4 py-3 rounded-xl border-2 transition-all"
                    style={{
                      borderColor: isSelected ? '#57CC86' : '#E5E7EB',
                      background: isSelected ? '#FFF9E6' : '#F9FAFB',
                      color: isSelected ? '#1A7D4E' : '#1A1A1A',
                      fontWeight: isSelected ? '600' : '400',
                    }}
                    onClick={() => handleChoice(opt.value)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部导航 */}
        <div className="flex items-center justify-between px-8 pb-7">
          <button
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all"
            style={{ color: '#6B7280', background: 'transparent' }}
            onClick={handleBack}
            disabled={isFirst}
          >
            <ChevronLeft size={16} />
            <span className="text-sm">上一步</span>
          </button>

          {/* 步骤点 */}
          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{
                  background: i === step ? '#57CC86' : i < step ? '#B8E6CD' : '#E5E7EB',
                  width: i === step ? '20px' : '6px',
                }}
              />
            ))}
          </div>

          {current.type === 'text' && (
            <button
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: canProceed ? '#57CC86' : '#F3F4F6',
                color: canProceed ? '#1A1A1A' : '#9CA3AF',
                cursor: canProceed ? 'pointer' : 'not-allowed',
              }}
              onClick={handleNext}
              disabled={!canProceed}
            >
              <span>{isLast ? '开始使用 🦞' : '下一步'}</span>
              {!isLast && <ChevronRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
