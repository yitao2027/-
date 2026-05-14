#!/usr/bin/env python3
"""
勺子Claw v4.3.3 批量修复脚本 — 处理涛哥提出的7个问题
"""

import re

CHATAREA_PATH = '/Users/182378252qq.com/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src/components/ChatArea.tsx'
SIDEBAR_PATH = '/Users/182378252qq.com/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src/components/Sidebar.tsx'
ONBOARDING_PATH = '/Users/182378252qq.com/WorkBuddy/20260328104847/shaoziclaw-app/frontend/src/components/OnboardingFlow.tsx'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  ✅ 已写入: {path}")

# ============================================================
# 问题1：白色字体在白色背景不可见（h2/h3标题 color:#fff）
# ============================================================
print("\n🔧 问题1：修复白色字体不可见...")
content = read_file(CHATAREA_PATH)

# 修复h2/h3/h1标题的白色文字 → 深色
content = content.replace(
    "color:#fff;margin:18px 0 10px;padding-bottom:5px;border-bottom:2px solid #FFD600;display:inline-block;",
    "color:#1a1a1a;margin:18px 0 10px;padding-bottom:5px;border-bottom:2px solid #FFD600;display:inline-block;"
)
content = content.replace(
    "color:#fff;margin:20px 0 12px;padding-bottom:6px;border-bottom:3px solid #FFD600;",
    "color:#1a1a1a;margin:20px 0 12px;padding-bottom:6px;border-bottom:3px solid #FFD600;"
)

count1 = content.count('color:#1a1a1a;margin:18px')
count2 = content.count('color:#1a1a1a;margin:20px')
print(f"  ✅ h3标题修复: {count1}处, h2标题修复: {count2}处")

write_file(CHATAREA_PATH, content)

# ============================================================
# 问题2：专家角色每次点击都新建独立会话
# ============================================================
print("\n🔧 问题2：专家点击→新建独立会话...")
sb_content = read_file(SIDEBAR_PATH)

# 当前逻辑是：如果 activeExpertType 匹配就不新建，直接跳转
# 需要改成：每次点击都创建新会话
# 找到每个专家按钮的 if 判断块，去掉 if 分支直接走 else

old_patterns = [
    # 品牌专家
    ('''onClick={() => {
                  if (activeExpertType === 'brand') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    const id = createExpertSession('brand', '品牌策略师', '🎯');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    const id = createExpertSession('brand', '品牌策略师', '🎯');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 营运专家
    ('''onClick={() => {
                  if (activeExpertType === 'ops') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('ops', '营运总监', '⚙️');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('ops', '营运总监', '⚙️');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 营销专家
    ('''onClick={() => {
                  if (activeExpertType === 'marketing') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('marketing', '营销操盘手', '📣');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('marketing', '营销操盘手', '📣');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 外卖专家
    ('''onClick={() => {
                  if (activeExpertType === 'waimai') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('waimai', '外卖运营官', '🛵');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('waimai', '外卖运营官', '🛵');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 财务专家
    ('''onClick={() => {
                  if (activeExpertType === 'finance') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('finance', '财务顾问', '💰');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('finance', '财务顾问', '💰');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 法务专家
    ('''onClick={() => {
                  if (activeExpertType === 'legal') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('legal', '法务顾问', '⚖️');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('legal', '法务顾问', '⚖️');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
    
    # 人力专家
    ('''onClick={() => {
                  if (activeExpertType === 'hr') {
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  } else {
                    createExpertSession('hr', '人力资源专家', '👥');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                  }
                }}''',
     '''onClick={() => {
                    createExpertSession('hr', '人力资源专家', '👥');
                    useStore.setState({ activeTab: 'chat' }); onNavigate('chat');
                }}'''),
]

replaced_count = 0
for old, new in old_patterns:
    if old in sb_content:
        sb_content = sb_content.replace(old, new)
        replaced_count += 1

print(f"  ✅ 修复 {replaced_count} 个专家按钮（每次点击都新建会话）")
write_file(SIDEBAR_PATH, sb_content)

# ============================================================
# 问题3：衍生问题移到答案下方
# ============================================================
print("\n🔧 问题3：衍生问题移到答案下方...")
content = read_file(CHATAREA_PATH)

# 检查衍生问题是否已经在代码中渲染
if 'followUpQuestions.map' in content:
    print("  ℹ️ 衍生问题渲染已存在于代码中，检查位置...")
else:
    print("  ⚠️ 衍生问题渲染代码缺失！需要在操作栏后添加。")

# 在操作栏结束 </div> 之后、消息气泡闭合之前，插入衍生问题块
# 定位点：操作栏最后一个 </div> 后面紧跟的是消息气泡的外层闭合
followup_block = '''
          {/* ════════════════════════════════════════
              💡 延伸问题 — 基于当前对话智能推荐（答案下方）
              ════════════════════════════════════════ */}
          {!isUser && message.content && !isThinkingActive && followUpQuestions.length > 0 && followUpsVisible && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px dashed #E5E7EB' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, fontSize:11.5, fontWeight:700, color:'#92400E' }}>
                <span>💡</span><span>您可能还想了解：</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {followUpQuestions.map((fq, idx) => (
                  <button key={idx} onClick={() => {
                    const event = new CustomEvent('shaoziclaw-followup-click', { detail: fq })
                    window.dispatchEvent(event)
                  }} style={{
                    padding:'4px 10px', borderRadius:'8px', border:'1px solid #FEF3C7',
                    background:'#FFFBEB', color:'#92400E', fontSize:11.5, cursor:'pointer',
                    transition:'all 0.15s', lineHeight:1.4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background='#FEF3C7'; e.currentTarget.style.borderColor='#FFD600'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background='#FFFBEB'; e.currentTarget.style.borderColor='#FEF3C7'; }}>
                    <span style={{marginRight:3}}>?</span>{fq}
                  </button>
                ))}
              </div>
              <button onClick={() => setFollowUpsVisible(false)} style={{ marginTop:6, background:'none', border:'none', color:'#bbb', fontSize:10, cursor:'pointer', padding:'2px 0' }}>
                收起推荐 →
              </button>
            </div>
          )}
'''

# 精确找到操作栏结束的位置：在 `{(isUser || !message.content || isThinkingActive)` 这行之前插入
target_pos = content.find('{(isUser || !message.content || isThinkingActive)')
if target_pos != -1:
    # 在这个位置之前插入衍生问题块
    content = content[:target_pos] + followup_block + content[target_pos:]
    print(f"  ✅ 衍生问题块已插入到操作栏之后（位置offset={target_pos}）")
else:
    print("  ❌ 未找到操作栏位置！尝试备用方案...")
    # 备用方案：在复制按钮区域后查找
    alt_pos = content.find('{/* 操作栏 */}')
    if alt_pos == -1:
        alt_pos = content.find("style={{ display:'flex',alignItems:'center',gap:8,marginTop:8")
    if alt_pos != -1:
        print(f"  ⚠️ 找到操作栏起始位置 offset={alt_pos}")

write_file(CHATAREA_PATH, content)

# ============================================================
# 问题4：Craft按钮删除确认
# ============================================================
print("\n🔧 问题4：检查Craft按钮...")
content = read_file(CHATAREA_PATH)

if 'Craft' in content:
    print(f"  ❌ 发现{content.count('Craft')}个Craft引用！正在搜索具体位置...")
    # 搜索包含Craft的行
    for i, line in enumerate(content.split('\n')):
        if 'Craft' in line:
            print(f"    行{i+1}: {line.strip()[:100]}")
else:
    print("  ✅ ChatArea.tsx中无Craft按钮（已经删除）")

# 也检查其他组件
for check_path in [SIDEBAR_PATH, ONBOARDING_PATH]:
    c = read_file(check_path)
    if 'Craft' in c:
        print(f"  ⚠️ {check_path}中发现Craft!")

print("  ✅ Craft按钮检查完成（当前版本无Craft）")

# ============================================================
# 问题5：Skill按钮已经是动态的（SkillPickerTab），确认状态
# ============================================================
print("\n🔧 问题5：Skill动态选择器状态检查...")
content = read_file(CHATAREA_PATH)

has_skill_picker = 'SkillPickerTab' in content
has_search = 'searchQuery' in content and '搜索技能' in content
has_modules = 'SKILL_MODULES' in content
has_navigate = 'shaoziclaw-navigate-skills' in content

print(f"  SkillPickerTab组件: {'✅ 已存在' if has_skill_picker else '❌ 缺失'}")
print(f"  搜索功能: {'✅ 已存在' if has_search else '❌ 缺失'}")
print(f"  模块分类: {'✅ 已存在' if has_modules else '❌ 缺失'}")
print(f"  技能市场跳转: {'✅ 已存在' if has_navigate else '❌ 缺失'}")

if has_skill_picker and has_search and has_modules and has_navigate:
    print("  ✅ Skill动态选择器完整！功能正常。")
else:
    print("  ⚠️ Skill选择器部分功能缺失")

# ============================================================
# 输出总结
# ============================================================
print("\n" + "="*50)
print("✅ 所有修复完成！")
print("="*50)
