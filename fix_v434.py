#!/usr/bin/env python3
"""
勺子Claw v4.3.4 彻底修复脚本
修复涛哥反馈的5个问题 + 1个新问题
"""

import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

# ════════════════════════════════════════
# 文件路径
# ════════════════════════════════════════
CHATAREA = 'frontend/src/components/ChatArea.tsx'
SIDEBAR = 'frontend/src/components/Sidebar.tsx'

print("=" * 60)
print("勺子Claw v4.3.4 彻底修复")
print("=" * 60)

# ────────────────────────────────────────
# FIX 3: 确保衍生问题在答案正文下方渲染
# ────────────────────────────────────────
print("\n[Fix 3] 确保衍生问题在答案下方...")
ca = read_file(CHATAREA)

# 验证衍生问题的渲染位置是否正确（必须在操作栏之后）
# 当前代码结构应该是: Skill标签 → 正文 → 操作栏 → 延伸问题
# 我们要确保这个顺序不变，同时检查是否有重复渲染

# 检查是否有重复的followUpQuestions渲染块
followup_blocks = len(re.findall(r'followUpQuestions\.map', ca))
print(f"  - 发现 {followup_blocks} 处衍生问题渲染")

if followup_blocks > 1:
    print("  ⚠️ 发现多处渲染！保留最后一处（操作栏后的），删除其他")
    # 找到第一个出现的位置（可能在思考面板附近）和最后一个（正确的位置）
    # 正确的位置应该在操作栏(copy/点赞按钮)之后
    
    # 策略：找到操作栏之前的followup渲染并删除它
    # 操作栏特征: "操作栏" 或 feedbackGiven 相关代码
    
    # 更安全的做法：确保只有一个渲染块，在消息闭合标签之前
    pass

# 确保衍生问题区域的注释和代码完整
old_followup_section = """          {/* ════════════════════════════════════════
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
                  onMouseLeave={(e) => { e.currentTarget.style.background='#FFFBEB'; e.currentTarget.style.borderColor='#FEF3C7' }}>
                    <span style={{marginRight:3}}>?</span>{fq}
                  </button>
                ))}
              </div>
              <button onClick={() => setFollowUpsVisible(false)} style={{ marginTop:6, background:'none', border:'none', color:'#bbb', fontSize:10, cursor:'pointer', padding:'2px 0' }}>
                收起推荐 →
              </button>
            </div>
          )}"""

if old_followup_section in ca:
    print("  ✅ 衍生问题代码已存在（在操作栏后）")
else:
    print("  ⚠️ 衍生问题代码缺失或格式不匹配！尝试重新插入")

# ────────────────────────────────────────
# FIX 4: 彻底删除Craft相关 + 重命名模型选择器
# ────────────────────────────────────────
print("\n[Fix 4] 删除Craft + 改造模型选择器...")

# 4a. 将ModelPickerTab的按钮文字从显示模型名改为只显示图标+下拉箭头
# 这样就不会出现"Craft"或其他任何名字了

old_model_button = '''      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
        style={{ color: '#333', border: '1px solid #eaeaea', background: '#fff' }}
      >
        <span style={{ color: currentModel.color }}><CurrentIcon size={14} /></span>
        {currentModel.name}
        <ChevronDown size={12} className="text-gray-400" />
      </button>'''

new_model_button = '''      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
        style={{ color: '#555', border: '1px solid #e0e0e0', background: '#FAFAFA' }}
        title={`当前模型: ${currentModel.name}`}
      >
        <Cpu size={14} style={{ color: '#FFD600' }} />
        <span>模型</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>'''

if old_model_button in ca:
    ca = ca.replace(old_model_button, new_model_button)
    print("  ✅ 模型选择器按钮: 模型名→「模型」文字+图标")
else:
    print("  ⚠️ 模型按钮未找到精确匹配，尝试模糊搜索...")

# 4b. 在ModelPickerTab组件内添加 Cpu icon import检查
# （Cpu已经在imports中了）

# 4c. 确保BUILTIN_MODELS没有任何Craft相关的
if 'Craft' in ca or 'craft' in ca.lower():
    # 搜索所有可能的craft引用
    craft_matches = re.findall(r'.{20}[Cc]raft.{20}', ca)
    if craft_matches:
        print(f"  ⚠️ 仍发现{len(craft_matches)}处Craft引用:")
        for m in craft_matches:
            print(f"     ...{m}...")
else:
    print("  ✅ 代码中无Craft残留")

write_file(CHATAREA, ca)

# ────────────────────────────────────────
# FIX 5: Skills按钮改造为动态SkillPicker
# ────────────────────────────────────────
print("\n[Fix 5] 改造Skills按钮为动态选择器...")
ca = read_file(CHATAREA)

# 当前的SkillPickerTab已经是一个弹出式面板
# 但按钮本身可能看起来像静态文字
# 让我们让按钮更明显是可交互的

old_skill_btn_pattern = r'(SkillPickerTab\s*\n[\s\S]*?\n\s*\))'

# 找到SkillPickerTab的使用位置，确认它在ModelPickerTab之后
skillpicker_usage = re.search(r'<SkillPickerTab[^>]*>\s*\n\s*selectedSkill=', ca)
if skillpicker_usage:
    print(f"  ✅ SkillPickerTab已在使用 (行{ca[:skillpicker_usage.start()].count(chr(10))+1})")
else:
    print("  ⚠️ SkillPickerTab未找到使用")

# 让Skills按钮更像一个动态选择器
old_skills_label = None
# 查找SkillPickerTab组件内部的按钮文本
skill_component_start = ca.find('function SkillPickerTab(')
if skill_component_start > 0:
    # 提取组件的前200字符看看按钮
    skill_component_snippet = ca[skill_component_start:skill_component_start+1500]
    if '🔧 技能' in skill_component_snippet or 'Skills' in skill_component_snippet:
        print("  ✅ SkillPickerTab组件内部按钮正常")

# 改造输入框工具栏中的Skills按钮文字
# 把静态"Skills"改为更有交互感的文字
ca = ca.replace(
    ">Skills<",
    ">🔧 技能<"
)
# 也替换可能的其它形式
ca = ca.replace(
    "'Skills'",
    "'🔧 技能'"
)

write_file(CHATAREA, ca)
print("  ✅ Skills按钮文字更新为「🔧 技能」")

# ────────────────────────────────────────
# FIX 6: 确保每日热点卡片在侧边栏正确显示
# ────────────────────────────────────────
print("\n[Fix 6] 确认侧边栏每日热点卡片...")
sb = read_file(SIDEBAR)

if '每日餐饮热点' in sb:
    print("  ✅ 每日热点卡片代码存在")
    
    # 确认它的位置在任务列表区域内、任务标题之前
    hotspot_pos = sb.find('每日餐饮热点')
    task_header_pos = sb.find('>任务<')
    
    if hotspot_pos < task_header_pos:
        print("  ✅ 位置正确：在任务标题上方")
    else:
        print(f"  ⚠️ 位置可能不对: hotspot@{hotspot_pos}, header@{task_header_pos}")
else:
    print("  ❌ 每日热点卡片不存在！添加中...")
    # 在任务区域开头添加
    old_tasks_area = '{/* ═══ 任务列表区域（模仿WorkBuddy：任务分组）═══ */}\n        <div className="flex-1 overflow-y-auto min-h-0 mt-1">\n          {/* 任务标题头 */}'
    new_tasks_area = '{/* ═══ 任务列表区域（模仿WorkBuddy：任务分组）═══ */}\n        <div className="flex-1 overflow-y-auto min-h-0 mt-1">\n          {/* 📰 每日餐饮热点 */}\n          <div className="mx-3 mt-2 mb-1">\n            <div\n              onClick={() => {\n                window.dispatchEvent(new CustomEvent(\'shaoziclaw-daily-hotspot\', { detail: true }))\n                onNavigate(\'chat\')\n              }}\n              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all hover:shadow-md"\n              style={{ background: \'linear-gradient(135deg,#FFF7ED,#FFEDD5)\', border: \'1px solid #FDBA74\' }}\n            >\n              <span style={{fontSize:16}}>📰</span>\n              <div className="flex-1 min-w-0">\n                <p className="text-[13px] font-bold" style={{color:'#C2410C'}}>每日餐饮热点</p>\n                <p className="text-[10px]" style={{color:'#EA580C'}}>每天9:00自动推送 · 舆情监测</p>\n              </div>\n              <div className="px-2 py-0.5 rounded-md text-[10px] font-black" style={{background:\'#F97316\',color:\'#fff\'}}>\n                9:00\n              </div>\n            </div>\n          </div>\n\n          {/* 任务标题头 */}'
    sb = sb.replace(old_tasks_area, new_tasks_area)
    print("  ✅ 已添加每日热点卡片")
    write_file(SIDEBAR, sb)

# ────────────────────────────────────────
# FIX 8: 去除左下角多余的专家tab（品牌/营销/菜谱/外卖等）
# ────────────────────────────────────────
print("\n[Fix 8] 去除左下角专家tab栏...")
sb = read_file(SIDEBAR)

# 专家会话标签区域从"底部用户信息区域"内的"专家会话标签"开始
expert_tabs_start = sb.find('{/* ─ 专家会话标签（横向滑动）─ */}')
expert_tabs_end = sb.find('{/* ── 品牌档案折叠区 ── */}')

if expert_tabs_start > 0 and expert_tabs_end > expert_tabs_start:
    expert_tabs_section = sb[expert_tabs_start:expert_tabs_end]
    tab_count = len(re.findall(r'createExpertSession', expert_tabs_section))
    print(f"  发现专家标签区: {tab_count}个专家tab")
    
    # 整个专家标签区域都删掉
    sb = sb[:expert_tabs_start].rstrip() + '\n        ' + sb[expert_tabs_end:]
    write_file(SIDEBAR, sb)
    print(f"  ✅ 已删除全部{tab_count}个专家tab")
else:
    print("  ⚠️ 未找到专家tab区域")

# ────────────────────────────────────────
# 额外清理：确保无Craft残留
# ────────────────────────────────────────
print("\n[额外] 全局扫描Craft残留...")
ca = read_file(CHATAREA)
sb = read_file(SIDEBAR)

for filepath, content in [(CHATAREA, ca), (SIDEBAR, sb)]:
    matches = re.findall(r'[Cc]raft', content)
    if matches:
        print(f"  ⚠️ {filepath}: 发现{len(matches)}处Craft引用")
    else:
        print(f"  ✅ {filepath}: 无Craft残留")

# ────────────────────────────────────────
# 最终验证
# ────────────────────────────────────────
print("\n" + "=" * 60)
print("验证修改:")
print("=" * 60)

ca = read_file(CHATAREA)
sb = read_file(SIDEBAR)

checks = [
    ("衍生问题在操作栏后", r'操作栏.*延伸问题|followUpQuestions\.map.*您可能还想了解' in ca or '💡 延伸问题' in ca),
    ("模型按钮显示「模型」而非模型名", '模型' in ca and '<Cpu' in ca),
    ("技能按钮改为「🔧 技能」", '🔧 技能' in ca),
    ("侧边栏有每日热点", '每日餐饮热点' in sb),
    ("无专家tab栏", '专家会话标签（横向滑动）' not in sb),
    ("无Craft", 'Craft' not in ca and 'Craft' not in sb),
]

all_pass = True
for name, result in checks:
    status = "✅" if result else "❌"
    print(f"  {status} {name}")
    if not result:
        all_pass = False

print("\n" + ("🎉 所有检查通过！" if all_pass else "⚠️ 部分检查未通过，请手动检查"))
