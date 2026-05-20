import { useState, useRef, useEffect, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import ImageDesignPanel from './ImageDesignPanel'
import {
  Send,
  Square,
  Sparkles,
  Zap,
  Brain,
  Trash2,
  Copy,
  Loader2,
  Cpu,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BookOpen,
  Calculator,
  Plus,
  Settings,
  X,
  Check,
  Search,
  File,
  FileText,
  Presentation,
  Eye,
  Film,
  FileDown,
} from 'lucide-react'
import { useAppStore, type Message, type ThinkingStep } from '../store'
import { exportToDocx, exportToPptx, exportToPdf, exportToHtml, exportToXlsx } from '../utils/documentGenerator'
// 【10】文件上传组件
import FileUploader from './FileUploader'
// 【11】共享Markdown渲染（从utils提取，供ChatArea/TaskChatDrawer复用）
import { renderMarkdownEnhanced } from '../utils/markdown'

// ====== 系统自带大模型（v5.0.0: 统一走墨行 Moxing API）======
const BUILTIN_MODELS = [
  { id: 'deepseek-v4', name: 'DeepSeek V4', icon: Zap, desc: '默认旗舰 · 深度推理', color: '#2563EB', hasKey: true },
  { id: 'glm-5.1', name: 'GLM-5.1', icon: Eye, desc: '图片分析 · 智谱旗舰', color: '#10B981', hasKey: true },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', icon: Brain, desc: '长文本 · 月之暗面', color: '#8B5CF6', hasKey: true },
]

const EXPERT_NAMES: Record<string, string> = {
  location: '选址猎人',
  cost: '成本控制师',
  menu: '菜单工程师',
  marketing: '营销操盘手',
  team: '团队教练',
  supply: '供应链管家',
  category: '品类顾问',
  risk: '风控卫士',
  expansion: '扩张军师',
  waimai: '外卖运营官',
}

// 🔧 v4.9.1 专家角色 System Prompt — 确保每次对话都维持专家人设
const EXPERT_SYSTEM_PROMPTS: Record<string, string> = {
  image: `你是图片设计专家，专注于餐饮行业的AI生图和多平台配图。你的能力包括：菜品AI精修、外卖平台配图（美团/饿了么/抖音/点评规格）、本地生活海报、门店展示位图、商圈推广物料。回答时要始终以"图片设计专家"的身份给出专业建议，关注视觉规范、平台合规要求、出图效率。`,
  brand: `你是品牌策略专家，专注餐饮品牌从0到1的全案策划。核心能力：品牌定位方法论、超级符号设计、招牌与视觉系统、竞品深度分析、品类战略占位。回答时始终以"品牌策略师"身份思考，强调差异化定位和品牌资产积累。`,
  ops: `你是餐饮营运专家（营运总监/QSCV体系专家）。你精通：QSCV质量标准、门店SOP标准化、门店健康诊断、翻台率坪效优化、用餐体验设计、食品安全管理、危机公关、数字化运营。回答始终以"营运专家"视角出发，注重可落地执行的标准流程。`,
  marketing: `你是餐饮营销操盘手/品牌宣传专家。擅长：营销活动策划、满减策略设计、会员运营、抖音/小红书内容运营、达人KOL合作、异业联盟、私域社群运营。回答以"营销专家"视角，重视ROI和可执行性。`,
  waimai: `你是外卖运营专家。精通美团/饿了么/淘宝闪购/京东外卖四大平台规则、外卖菜单工程、满减活动设计、排名优化、差评管理、配送履约优化。回答以外卖运营专业角度出发，关注单量、转化率、客单价。`,
  finance: `你是餐饮财务顾问。覆盖：成本精细化管控、食材标准成本卡、毛利率分析、人力成本管控、现金流管理、财务报表解读、税务合规。回答以数据驱动决策为核心，帮老板看懂数字背后的经营真相。`,
  legal: `你是法务合规顾问。专精：餐饮全链路法律风险防控、合同审核、劳动用工合规、食安法规、广告法合规、预付卡管理、知识产权保护、加盟合同纠纷预防。回答严谨引用相关法规条款。`,
  hr: `你是人力资源专家（含科学排班）。覆盖：招聘实战、培训体系设计、排班优化（全职/小时工组合、时段匹配）、薪酬绩效设计、员工留存策略、00后管理、劳动关系合规。回答注重实操性和人效提升。`,
  supply: `你是供应链专家（含科学订货）。精通：供应商管理、BOM配方管理、销量预测模型、安全库存计算、采购谈判、验收质检、库存周转优化。以降低损耗和控制成本为核心目标。`,
  data: `你是数据分析师。擅长：经营数据看板搭建、日报/周报/月报模板、关键指标监控、异常预警、数据驱动决策场景分析。用数据说话，帮助餐饮老板从数字中发现问题和机会。`,
  strategy: `你是战略规划专家（连锁扩张/品牌架构/融资/开店顾问）。覆盖：连锁模式设计、多品牌战略、融资谈判、选址千分法、开店筹备SOP、退出规划。站在老板的视角做顶层设计和战略决策建议。`,
  space: `你是空间设计/选址专家。精通：千分选址法、商圈评估、空间效率优化、动线设计、门头设计、装修预算控制、坪效最大化。回答注重视觉体验和运营效率的平衡。`,
  general: `你是勺子Claw——餐饮人的超级AI大脑。你是一个综合型餐饮AI助手，覆盖选址、成本、菜单、营销、运营、人力、财务、法务等全链路知识。回答要专业、实用、可执行，像一个有经验的餐饮顾问一样给建议。`,
}

// Tauri事件通道名（必须和后端 ai_engine.rs 中 EVT_CHANNEL 一致）
const STREAM_EVENT = 'shaoziclaw-stream-event'

export default function ChatArea() {
  const [input, setInput] = useState('')
  const [showCustomModal, setShowCustomModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const unlistenRef = useRef<UnlistenFn | null>(null)
  const sessionStartRef = useRef<number>(0) // 📊 v5.2: 行为追踪用

  // 🆕 使用任务系统的store
  const {
    activeTaskId, createTask,
    getActiveMessages, addMessageToActive, updateMessageInActive, clearActiveMessages,
    messages: rawMessages, // 🔧 B009修复：直接解构messages作为依赖信号
    isGenerating, setIsGenerating, generatingContext, setGeneratingContext,
    currentModel, setCurrentModel, selectedSkill, setSelectedSkill,
    tokenUsed, tokenLimit,
    customModels, addCustomModel, removeCustomModel, setActiveModelId, activeModelId,
    // 【1】专家会话
    expertSessions, activeExpertSessionId, activeExpertType,
    addMessageToExpertSession, updateExpertMessage,
    // ⏰💬 任务会话（v4.9.9）
    taskSessions, activeTaskSessionId,
    addMessageToTaskSession, updateTaskSessionMessage,
    // 文件上传
    uploadedFiles, removeUploadedFile, clearUploadedFiles,
  } = useAppStore()

  // 🛑 v5.2: 当前窗口上下文ID，用于判断是否本窗口正在生成
  const myContextId = activeExpertSessionId || activeTaskSessionId || activeTaskId || 'main'
  const isMyWindowGenerating = generatingContext === myContextId

  // 🔧 B086v3: 组件挂载时无条件清除残留的generatingContext
  // 重启后任何残留锁都是无效的，必须清除，否则输入框被disabled导致死锁
  const mountClearedRef = useRef(false)
  useEffect(() => {
    if (!mountClearedRef.current) {
      mountClearedRef.current = true
      const ctx = useAppStore.getState().generatingContext
      console.log(`[DIAG-B089] ChatArea挂载! generatingContext=${ctx} myContextId=${myContextId} isMyWindowGenerating=${isMyWindowGenerating} activeExpertSessionId=${useAppStore.getState().activeExpertSessionId} activeTaskSessionId=${useAppStore.getState().activeTaskSessionId}`)
      if (ctx) {
        console.warn(`[B086v3] 挂载时清除残留锁: ${ctx}, myCtx=${myContextId}`)
        setGeneratingContext(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🔧 B092: 原生DOM事件监听诊断发送按钮
  const sendBtnRef = useRef<HTMLButtonElement | null>(null)
  // 必须在useEffect之前定义，否则TDZ错误
  const nativeClickHandler = (e: Event) => {
    console.log('[DIAG-B092] 🔥 原生click事件捕获! target:', (e.target as HTMLElement).tagName, 'currentTarget:', (e.currentTarget as HTMLElement).tagName)
    let el: HTMLElement | null = e.target as HTMLElement
    const path: string[] = []
    while (el) {
      path.push(el.tagName + (el.className ? '.'+el.className.split(' ')[0] : ''))
      el = el.parentElement
    }
    console.log('[DIAG-B092] 事件路径:', path.join(' → '))
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = document.querySelector('.chat-input-container button') as HTMLButtonElement | null
      if (btn) {
        sendBtnRef.current = btn
        console.log('[DIAG-B092] 找到发送按钮:', btn.tagName, 'disabled:', btn.disabled)
        btn.removeEventListener('click', nativeClickHandler)
        btn.addEventListener('click', nativeClickHandler, true)
      } else {
        console.log('[DIAG-B092] 未找到发送按钮，尝试其他选择器...')
        const allBtns = document.querySelectorAll('button')
        allBtns.forEach(b => {
          const svg = b.querySelector('svg')
          if (svg && b.closest('.chat-input-container')) {
            sendBtnRef.current = b as HTMLButtonElement
            console.log('[DIAG-B092] 备用找到发送按钮')
            b.removeEventListener('click', nativeClickHandler)
            b.addEventListener('click', nativeClickHandler, true)
          }
        })
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [activeTaskSessionId, activeExpertSessionId])

  // 获取消息：优先级：专家会话 > 任务会话 > 普通消息
  // 🔧 B009修复：rawMessages作为依赖信号，确保更新时useMemo重新计算
  const messages = useMemo(() => {
    // 1. 专家会话模式
    if (activeExpertSessionId) {
      const session = expertSessions.find(s => s.id === activeExpertSessionId)
      if (session && session.messages.length > 0) return session.messages
      // 🔧 防御性：从localStorage直接加载（应对Tauri WebView批处理延迟）
      try {
        const saved = localStorage.getItem('shaoziclaw_expert_sessions')
        if (saved) {
          const allSessions = JSON.parse(saved)
          const found = allSessions.find((s: any) => s.id === activeExpertSessionId)
          if (found && found.messages?.length > 0) return found.messages
        }
      } catch {}
      return []
    }

    // 2. ⏰ 任务会话模式（v4.9.9）
    if (activeTaskSessionId) {
      const session = taskSessions.find(s => s.id === activeTaskSessionId)
      if (session && session.messages.length > 0) return session.messages
      // 防御性：从localStorage加载
      try {
        const saved = localStorage.getItem('shaoziclaw_task_sessions')
        if (saved) {
          const allSessions = JSON.parse(saved)
          const found = allSessions.find((s: any) => s.id === activeTaskSessionId)
          if (found && found.messages?.length > 0) return found.messages
        }
      } catch {}
      return []
    }

    // 🔧 B009修复：直接用解构的rawMessages，不依赖getActiveMessages()函数引用
    return rawMessages
  }, [activeExpertSessionId, expertSessions, activeTaskSessionId, taskSessions, rawMessages])

  // 🆕 更新消息的 thinkingSteps
  const updateThinking = (msgId: string, steps: ThinkingStep[], complete: boolean) => {
    updateMessageInActive(msgId, { thinkingSteps: steps, isThinkingComplete: complete })
  }

  const handleStop = () => {
    console.log('[停止按钮] 点击停止，调用 abort_generation...')
    invoke('abort_generation')
      .then(() => console.log('[停止按钮] abort_generation 调用成功'))
      .catch((e) => console.warn('[停止按钮] 调用失败:', e))
  }

  const handleSend = async (autoText?: string) => {
    // 🔧 DIAG-B089: handleSend入口诊断
    console.log(`[DIAG-B089] handleSend调用! autoText="${autoText?.substring(0,30) || 'undefined'}" input="${input.substring(0,30)}" files=${uploadedFiles.length}`)
    console.log(`[DIAG-B089] store状态: generatingContext=${useAppStore.getState().generatingContext} isGenerating=${useAppStore.getState().isGenerating} activeTaskId=${useAppStore.getState().activeTaskId} activeExpertSessionId=${useAppStore.getState().activeExpertSessionId} activeTaskSessionId=${useAppStore.getState().activeTaskSessionId}`)

    sessionStartRef.current = Date.now()
    const textToSend = (autoText || input).trim()

    // 🔧 B086v3: 只处理本窗口残留锁（其他窗口残留已在useEffect挂载时清理）
    const entryCtx = useAppStore.getState().generatingContext
    if (entryCtx === myContextId) {
      // 本窗口有残留锁（上一条消息未正常结束），强制abort+清除
      console.warn(`[B086v3] 本窗口残留锁 → abort_generation+清除`)
      invoke('abort_generation').catch(() => {})
      setGeneratingContext(null)
    }

    // 允许只有文件没有文字的情况
    if (!textToSend && uploadedFiles.length === 0) {
      return
    }

    // 【文件附件】检查是否有已上传文件，提取内容作为上下文
    const { uploadedFiles: currentFiles } = useAppStore.getState()
    let fileContext = ''
    // 🔧 Bug1修复：收集图片dataUrl用于vision多模态传输
    let imageDataList: { dataUrl: string; name: string }[] = []
    if (currentFiles.length > 0) {
      const fileInfos = currentFiles.map(f => {
        let preview = ''
        // 🔧 图片：记录名称 + 保留dataUrl用于vision分析
        if (f.type === 'image' && f.dataUrl) {
          preview = `[图片: ${f.name}, 大小: ${(f.size / 1024).toFixed(1)}KB]`
          imageDataList.push({ dataUrl: f.dataUrl, name: f.name })
        }
        // 🔧 docx/pdf/xlsx：已在FileUploader中提取文本，直接用content
        else if ((f.type === 'docx' || f.type === 'pdf') && f.content) {
          const text = f.content.substring(0, 5000)
          const label = f.type === 'pdf' ? 'PDF文件' : 'Word文档'
          preview = `[${label}: ${f.name}]\n--- 文档内容 ---\n${text}${f.content.length > 5000 ? '\n...(文档过长，仅展示前5000字)' : ''}`
        }
        // 🔧 Excel/其他document类：content已在FileUploader中提取
        else if (f.type === 'document' && f.content) {
          const text = f.content.substring(0, 5000)
          preview = `[文档: ${f.name}]\n--- 内容预览 ---\n${text}${f.content.length > 5000 ? '\n...(文档过长，仅展示前5000字)' : ''}`
        }
        // 纯文本文件（TXT等）：从dataUrl安全读取
        else if (f.type === 'document' && f.dataUrl) {
          try {
            // 仅对TXT等纯文本文件尝试解码base64，PDF/XLSX等已在FileUploader中提取
            if (f.name.toLowerCase().endsWith('.txt')) {
              const base64 = f.dataUrl?.split(',')[1] || ''
              if (base64) {
                const decoded = atob(base64)
                preview = `[文本: ${f.name}]\n--- 内容预览 ---\n${decoded.substring(0, 3000)}${decoded.length > 3000 ? '\n...(文件过长，仅展示前3000字)' : ''}`
              } else {
                preview = `[文件: ${f.name}, 大小: ${(f.size / 1024).toFixed(1)}KB]`
              }
            } else {
              preview = `[文件: ${f.name}, 大小: ${(f.size / 1024).toFixed(1)}KB]（内容已解析）`
            }
          } catch {
            preview = `[文件: ${f.name}, 大小: ${(f.size / 1024).toFixed(1)}KB]`
          }
        } else {
          preview = `[文件: ${f.name} (${f.type}), 大小: ${(f.size / 1024).toFixed(1)}KB]`
        }
        return preview
      }).join('\n\n')
      fileContext = `\n\n📎 用户上传了以下${currentFiles.length}个文件，请基于这些文件的内容结合用户问题进行分析和回答：\n${fileInfos}\n\n---\n用户的问题：`
    }

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 11),
      role: 'user', 
      content: textToSend || '(文件分析请求)', 
      timestamp: new Date(),
      attachments: currentFiles.length > 0 ? [...currentFiles] : undefined,
    }

    // 【1】专家会话/任务会话：消息添加到对应会话（v5.3.2: getState避免闭包）
    const expId = useAppStore.getState().activeExpertSessionId
    const taskSesId = useAppStore.getState().activeTaskSessionId
    if (expId) {
      invoke('log_frontend', { level: 'INFO', module: 'ChatArea', msg: `路由到专家会话: ${expId}` }).catch(() => {})
      addMessageToExpertSession(expId, userMessage)
    } else if (taskSesId) {
      invoke('log_frontend', { level: 'INFO', module: 'ChatArea', msg: `路由到任务会话: ${taskSesId}` }).catch(() => {})
      addMessageToTaskSession(taskSesId, userMessage)
    } else {
      invoke('log_frontend', { level: 'WARN', module: 'ChatArea', msg: '路由到主窗口(无expId/taskSesId)' }).catch(() => {})
      // 普通模式：创建任务并添加消息
      let taskId = activeTaskId
      if (!taskId) {
        taskId = createTask(textToSend.length > 20 ? textToSend.substring(0, 20) + '...' : textToSend)
      }
      addMessageToActive(userMessage)
    }

    if (!autoText) setInput('')
    // 发送后清空上传的文件
    if (fileContext) {
      const { removeUploadedFile } = useAppStore.getState()
      useAppStore.getState().uploadedFiles.forEach(f => removeUploadedFile(f.id))
    }
    setGeneratingContext(myContextId)

    // 💳 积分预检（积分用户：发消息前检查余额）
    const jwtToken = localStorage.getItem('shaoziclaw_jwt_token')
    if (jwtToken) {
      try {
        const { estimateAiCost } = await import('../services/pointsApi')
        const storeState = useAppStore.getState()
        const effectiveModel = storeState.activeModelId
          ? storeState.customModels.find(m => m.id === storeState.activeModelId)?.model || storeState.currentModel
          : storeState.currentModel
        const estimation = await estimateAiCost(effectiveModel)
        if (!estimation.canAfford) {
          // 余额不足，阻止发送
          const errMsg = `⚠️ 积分不足\n\n当前余额：${estimation.currentBalance} 积分\n预估需要：约${estimation.estimatedCost} 积分\n\n请前往「设置 → 积分充值」补充积分后继续使用`
          const curExpert3 = useAppStore.getState().activeExpertSessionId
          if (curExpert3) {
            updateExpertMessage(curExpert3, assistantId, { content: errMsg, isThinkingComplete: true })
          } else if (activeTaskSessionId) {
            updateTaskSessionMessage(activeTaskSessionId, assistantId, { content: errMsg, isThinkingComplete: true })
          } else {
            updateMessageInActive(assistantId, { content: errMsg, isThinkingComplete: true })
          }
          setGeneratingContext(null)
          return
        }
      } catch (e) {
        console.warn('[积分预检] 检查失败，放行:', e)
      }
    }

    // 创建 assistant 消息占位
    const assistantId = Math.random().toString(36).substring(2, 11)
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      thinkingSteps: [],
      isThinkingComplete: false,
    }

    // 【1】添加到对应的消息列表（v5.3.2: getState避免闭包）
    const curExpId = useAppStore.getState().activeExpertSessionId
    const curTaskSesId = useAppStore.getState().activeTaskSessionId
    if (curExpId) {
      addMessageToExpertSession(curExpId, assistantMsg)
    } else if (curTaskSesId) {
      addMessageToTaskSession(curTaskSesId, assistantMsg)
    } else {
      addMessageToActive(assistantMsg)
    }

    try {
      let accumulatedSteps: ThinkingStep[] = []
      let finalContent = ''
      let ragUsed = false  // 📚 v5.1: 标记本次回答是否使用了RAG知识库

      // 注册实时事件监听
      unlistenRef.current = await listen(STREAM_EVENT, (event) => {
        const payload = event.payload as any
        const eventType = payload.event_type
        const step = payload.step


        if (step && step.title && typeof step === 'object') {
          // 🆕 v4.6.1 [#5a] 去重：同 title 的步骤只保留最新一条（更新 content）
          const newStep = {
            stepType: step.step_type || eventType,
            title: step.title,
            content: step.content || '',
            icon: step.icon || '',
            durationMs: 0,
          }
          // 📚 v5.1→v5.5.3: 检测RAG检索事件（含新的tool/tool_done类型）
          if (eventType === 'knowledge_retrieval' || eventType === 'tool' || eventType === 'tool_done'
              || step.title?.includes('知识库') || step.title?.includes('RAG') || step.icon === '✅') {
            ragUsed = true
          }
          const dupIndex = accumulatedSteps.findIndex(s => s.title === newStep.title)
          if (dupIndex >= 0) {
            // 已存在同名步骤 → 更新内容（流式拼接）
            accumulatedSteps = accumulatedSteps.map((s, i) =>
              i === dupIndex ? { ...s, content: newStep.content || s.content } : s
            )
          } else {
            accumulatedSteps = [...accumulatedSteps, newStep]
          }
          // 🔧 v5.3.6: 同时检查专家和任务会话，避免任务内容泄漏到主窗口
          const curExpertId = useAppStore.getState().activeExpertSessionId
          const curTaskSesId = useAppStore.getState().activeTaskSessionId
          if (curExpertId) {
            updateExpertMessage(curExpertId, assistantId, { thinkingSteps: [...accumulatedSteps], isThinkingComplete: false })
          } else if (curTaskSesId) {
            updateTaskSessionMessage(curTaskSesId, assistantId, { thinkingSteps: [...accumulatedSteps], isThinkingComplete: false })
          } else {
            updateThinking(assistantId, [...accumulatedSteps], false)
          }
        } else if (eventType === 'content_chunk') {
          finalContent = payload.content || ''
          const curExpertId4 = useAppStore.getState().activeExpertSessionId
          const curTaskSesId3 = useAppStore.getState().activeTaskSessionId
          if (curExpertId4) {
            updateExpertMessage(curExpertId4, assistantId, { content: finalContent, isThinkingComplete: true })
          } else if (curTaskSesId3) {
            updateTaskSessionMessage(curTaskSesId3, assistantId, { content: finalContent, isThinkingComplete: true })
          } else {
            updateMessageInActive(assistantId, { content: finalContent, isThinkingComplete: true })
          }
        } else if (eventType === 'done') {
          // 🔧 v5.5.4: done时必须带上finalContent，防止content_chunk被遗漏
          // 🔧 v5.5.5: 批处理可能导致content_chunk从不触发 → payload.content兜底
          const doneUpdates: any = { thinkingSteps: accumulatedSteps, isThinkingComplete: true }
          if (finalContent) {
            doneUpdates.content = finalContent
          } else if (payload.content) {
            // 兜底：content_chunk因批处理阈值(50ms/20字符)从未触发时，直接使用done事件的content
            finalContent = String(payload.content)
            doneUpdates.content = finalContent
          }
          if (ragUsed) doneUpdates.ragSources = [{ skillName: 'RAG', category: 'knowledge-base', sourceFile: '', chunkIndex: 0, score: 1 }]
          const curExpertId2 = useAppStore.getState().activeExpertSessionId
          const curTaskSesId2 = useAppStore.getState().activeTaskSessionId
          if (curExpertId2) {
            updateExpertMessage(curExpertId2, assistantId, doneUpdates)
          } else if (curTaskSesId2) {
            updateTaskSessionMessage(curTaskSesId2, assistantId, doneUpdates)
          } else {
            updateMessageInActive(assistantId, doneUpdates)
          }
          // 🧠 v5.2: 触发长期记忆压缩（异步，不阻塞UI）
          // 不限制字数，由 LLM 自行判断是否有值得记忆的内容
          if (finalContent) {
            const recentState = useAppStore.getState()
            const recentMsgs = recentState.getActiveMessages().slice(-6).map(m => ({
              role: m.isUser ? 'user' : 'assistant',
              content: typeof m.content === 'string' ? m.content.slice(0, 1000) : ''
            }))
            console.log('[Memory] compress_memory 触发, msgs:', recentMsgs.length)
            invoke('compress_memory', { messagesJson: JSON.stringify(recentMsgs) })
              .then((result: any) => console.log('[Memory] 压缩成功:', result))
              .catch((err) => console.error('[Memory] 压缩失败:', err))
          }
          // 📊 v5.2: 记录行为数据（异步）
          if (finalContent) {
            const duration = Math.round((Date.now() - sessionStartRef.current) / 1000)
            const features = [
              ...(ragUsed ? ['rag'] : []),
              ...(uploadedFiles.length > 0 ? ['file_upload'] : []),
              ...(imageDataList.length > 0 ? ['image_analysis'] : []),
            ]
            invoke('record_interaction', {
              userQuery: textToSend.slice(0, 500),
              replyLength: finalContent.length,
              features,
              sessionDurationSecs: duration,
            }).catch(() => {})
            // 🌱 v5.2: 知识演进（异步提取新知识）
            if (finalContent.length > 500) {
              invoke('evolve_knowledge', {
                userQuery: textToSend.slice(0, 1000),
                aiResponse: finalContent.slice(0, 2000),
              }).catch(() => {})
            }
          }
        } else if (eventType === 'aborted') {
          // 🛑 v5.2: 用户点击停止 — 保留部分内容，标记为中断
          const abortNote = finalContent
            ? '\n\n---\n⏹ *（AI 生成已被用户中断，以上为已生成的部分内容，可继续追问或重新提问）*'
            : '⏹ *AI 生成已被用户中断，你可以继续追问或重新提问*'
          const abortUpdates: any = {
            thinkingSteps: accumulatedSteps,
            isThinkingComplete: true,
            content: finalContent ? finalContent + abortNote : abortNote,
          }
          const abortExpId = useAppStore.getState().activeExpertSessionId
          const abortTaskSesId = useAppStore.getState().activeTaskSessionId
          if (abortExpId) {
            updateExpertMessage(abortExpId, assistantId, abortUpdates)
          } else if (activeTaskSessionId) {
            updateTaskSessionMessage(activeTaskSessionId, assistantId, abortUpdates)
          } else {
            updateMessageInActive(assistantId, abortUpdates)
          }
        }
      })

      // 获取当前所有消息用于API调用（从正确的来源，用getState获取最新值避免闭包过期）
      const storeState = useAppStore.getState()
      const currentMsgs = activeExpertSessionId
        ? (storeState.expertSessions.find(s => s.id === activeExpertSessionId)?.messages || [])
        : activeTaskSessionId
          ? (storeState.taskSessions.find(s => s.id === activeTaskSessionId)?.messages || [])
          : storeState.getActiveMessages()
      
      // 【7】读取用户记忆档案，注入到每次对话中
      let userContextPrompt = ''
      try {
        const mem = JSON.parse(localStorage.getItem('shaoziclaw_user_memory') || '{}')
        if (mem.contextPrompt) userContextPrompt = mem.contextPrompt
      } catch {}

      // 🧠 v5.5.35: 注入分层记忆上下文（L1原子事实 + L2近期场景 + L3用户画像）
      let layeredMemoryPrompt = ''
      try {
        const userId = localStorage.getItem('shaoziclaw_user_id') || 'default'
        const layeredCtx: any = await invoke('get_layered_context', { userId })
        if (layeredCtx) {
          const parts: string[] = []
          if (layeredCtx.persona_summary) parts.push(`【用户画像】${layeredCtx.persona_summary}`)
          if (layeredCtx.key_facts && layeredCtx.key_facts.length > 0) {
            parts.push(`【关键事实】${layeredCtx.key_facts.map((f: any) => `${f.key}: ${f.value}`).join('；')}`)
          }
          if (layeredCtx.recent_scenarios && layeredCtx.recent_scenarios.length > 0) {
            const scenarioLines = layeredCtx.recent_scenarios.slice(0, 3).map((s: any) =>
              `- [${s.date || '近期'}] ${s.topic}: ${s.outcome || s.solution || ''}`
            ).join('\n')
            parts.push(`【近期场景】\n${scenarioLines}`)
          }
          if (parts.length > 0) {
            layeredMemoryPrompt = `[分层记忆]\n${parts.join('\n')}\n\n请结合以上用户背景信息，给出更个性化的回答。`
          }
        }
      } catch (e) {
        console.warn('[分层记忆] 获取失败（不影响正常对话）:', e)
      }

      // 🌐 实时信息预获取：检测用户消息是否包含实时查询关键词
      let realtimeData = ''
      const realtimeKeywords = ['今天', '最新', '现在', '实时', '今日', '本周', '本月', '今年', '热搜', '热点', '新闻']
      const isRealtimeQuery = realtimeKeywords.some(k => textToSend.includes(k))
      if (isRealtimeQuery) {
        try {
          const boards: any[] = await invoke('fetch_hot_trends', { platform: null })
          if (boards && boards.length > 0) {
            const now = new Date().toLocaleString('zh-CN')
            let hotText = `## 🌐 实时全网热榜数据（${now}）\n\n`
            for (const board of boards.slice(0, 8)) {
              hotText += `**${board.name}**（${board.platform}）\n`
              for (const item of (board.items || []).slice(0, 5)) {
                hotText += `${item.rank}. ${item.title}${item.hot ? ` [🔥${item.hot}]` : ''}\n`
              }
              hotText += '\n'
            }
            hotText += '以上是最新实时热榜数据，请基于这些真实数据回答用户的问题。'
            realtimeData = hotText
          }
        } catch (e) {
          console.warn('实时热榜获取失败:', e)
        }
      }

      // 构建消息列表（系统提示+实时数据+历史消息+文件附件上下文）
      const apiMessages: any[] = []

      // 🔧 v4.9.1 核心：注入专家角色 system prompt（解决首句后失去人设的Bug）
      if (activeExpertSessionId && activeExpertType) {
        const session = storeState.expertSessions.find(s => s.id === activeExpertSessionId)
        const expertName = session?.expertName || EXPERT_NAMES[activeExpertType] || '餐饮专家'
        const expertPrompt = EXPERT_SYSTEM_PROMPTS[activeExpertType] || EXPERT_SYSTEM_PROMPTS['general']
        // 用更具体的会话名称替换通用名称
        const personalizedPrompt = expertPrompt.replace(
          /你是[^，。]/,
          `你是${expertName}（${expertName}），`
        )
        apiMessages.push({
          role: 'system',
          content: `[角色设定] ${personalizedPrompt}\n\n请始终以${expertName}的专业身份回答用户问题，保持角色一致性，不要切换成普通助手模式。`,
        })
      }

      // ⏰ v4.9.9: 注入任务会话上下文（promptTemplate作为系统前缀）
      if (activeTaskSessionId && !activeExpertSessionId) {
        const taskSession = storeState.taskSessions.find(s => s.id === activeTaskSessionId)
        if (taskSession) {
          const taskContext = taskSession.promptTemplate
            ? `[任务背景] 你是「${taskSession.taskName}」的任务助手。以下是该定时任务的背景设定，请在回答时参考：\n${taskSession.promptTemplate}\n\n请始终以任务助手的身份回答用户关于此任务的问题。`
            : `[任务背景] 你是「${taskSession.taskName}」的任务助手。请协助用户管理、执行和优化该定时任务。`;
          apiMessages.push({ role: 'system', content: taskContext });
          // 如果有 skillName 也带上
          if (taskSession.skillName) {
            // skillName 会通过 use_skill 参数传递给后端
          }
        }
      }

      if (userContextPrompt) {
        apiMessages.push({ role: 'system', content: userContextPrompt })
      }
      // 🧠 v5.5.35: 注入分层记忆（L1+L2+L3）
      if (layeredMemoryPrompt) {
        apiMessages.push({ role: 'system', content: layeredMemoryPrompt })
      }
      // 注入实时数据作为system上下文
      if (realtimeData) {
        apiMessages.push({ role: 'system', content: realtimeData })
      }
      currentMsgs.filter(m => m.id !== assistantId).forEach(m => {
        // 在最后一条用户消息中注入文件附件内容
        // 🔧 修复：同时匹配纯图片上传(content='(文件分析请求)')和文字+图片混合场景
        const isLastUserMsgWithImage = m.role === 'user' && fileContext && imageDataList.length > 0 && (m.content === textToSend || m.content === '(文件分析请求)')
        if (isLastUserMsgWithImage) {
          // 🔧 Vision消息：只传简洁提示文本+图片，不传文件描述占位符（避免干扰模型）
          const visionText = textToSend || '请详细分析这张图片的内容。'
          const contentParts: any[] = [
            { type: 'text', text: visionText }
          ]
          // 每张图片作为一个image_url part
          for (const img of imageDataList) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: img.dataUrl }
            })
          }
          apiMessages.push({ role: m.role, content: contentParts })
        } else if (m.role === 'user' && fileContext && !imageDataList.length && m.content === textToSend) {
          // 无图片：纯文本模式（文档等）
          apiMessages.push({ role: m.role, content: fileContext + m.content })
        } else {
          apiMessages.push({ role: m.role, content: m.content })
        }
      })

      // 确定实际使用的技能（优先级：专家会话skill > 任务会话skill > 用户选择的skill）
      // 🔧 v5.5.22 Bug#2修复：专家会话的skillName最优先，避免selectedSkill全局漂移导致路由错误
      const effectiveSkill = (() => {
        if (activeExpertSessionId) {
          const es = storeState.expertSessions.find(s => s.id === activeExpertSessionId);
          if (es?.skillName) return es.skillName;
        }
        if (activeTaskSessionId && !activeExpertSessionId) {
          const ts = storeState.taskSessions.find(s => s.id === activeTaskSessionId);
          if (ts?.skillName) return ts.skillName;
        }
        return selectedSkill || null;
      })();

      // 确定实际使用的模型（系统模型 or 自定义模型）
      let effectiveModel = isUsingCustom && activeCustom ? activeCustom.id : currentModel

      // 🔧 Vision智能路由：有图片但当前模型不支持vision → 自动切到Kimi-K2.5
      // ⚠️ GLM-5.1是纯文本模型，不支持image_url！Kimi-K2.5（月之暗面）原生支持vision多模态
      const VISION_MODELS = ['kimi-k2.5', 'kimi']
      if (imageDataList.length > 0 && !VISION_MODELS.includes(effectiveModel)) {
        effectiveModel = 'kimi-k2.5'
        console.log(`[Vision路由] 检测到${imageDataList.length}张图片，模型自动切换 → Kimi-K2.5（vision）`)
      }

      // 🔍 Vision诊断：确认即将发送的请求中包含图片数据
      if (imageDataList.length > 0) {
        const lastMsg = apiMessages[apiMessages.length - 1]
        const isVisionArray = Array.isArray(lastMsg?.content)
        console.log(`[Vision诊断-前端] effectiveModel=${effectiveModel} | 图片数=${imageDataList.length} | 最后消息content是数组=${isVisionArray} | dataUrl前20字符=${imageDataList[0]?.dataUrl?.substring(0, 20)}`)
      }

      // 📊 DIAG: 记录即将发送的chat_stream请求关键信息
      const lastApiMsg = apiMessages[apiMessages.length - 1]
      console.log(`[DIAG-ChatStream] 调用前: model=${effectiveModel} skill=${effectiveSkill} msgs=${apiMessages.length} lastMsgLen=${typeof lastApiMsg?.content==='string'?lastApiMsg.content.length:JSON.stringify(lastApiMsg?.content).length} fileContext=${!!fileContext} imageCount=${imageDataList.length}`)

      try {
        const invokeResult = await invoke('chat_stream', {
        request: {
          messages: apiMessages,
          model: effectiveModel, temperature: 0.7, max_tokens: 4096,
          use_skill: effectiveSkill, stream: false,
          session_id: activeExpertSessionId || activeTaskSessionId || activeTaskId || null,
        },
      })
        console.log(`[DIAG-ChatStream] 调用完成: resultLen=${invokeResult ? String(invokeResult).length : 0}`)

      // BUG FIX: 如果事件系统没推送content_chunk（竞态/丢失），用invoke返回值兜底
      if (!finalContent && invokeResult) {
        const fallbackContent = String(invokeResult)
        finalContent = fallbackContent
        const fallbackUpdates: any = { content: finalContent, isThinkingComplete: true, thinkingSteps: accumulatedSteps }
        if (activeExpertSessionId) {
          updateExpertMessage(activeExpertSessionId, assistantId, fallbackUpdates)
        } else if (activeTaskSessionId) {
          updateTaskSessionMessage(activeTaskSessionId, assistantId, fallbackUpdates)
        } else {
          updateMessageInActive(assistantId, fallbackUpdates)
        }
      }
      } catch (invErr: any) {
        throw invErr
      }

      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }

      // 💳 积分扣减（积分用户：AI返回后记录消耗）
      if (jwtToken && finalContent) {
        try {
          const { recordAiUsage } = await import('../services/pointsApi')
          const storeState2 = useAppStore.getState()
          const effModel = storeState2.activeModelId
            ? storeState2.customModels.find(m => m.id === storeState2.activeModelId)?.model || storeState2.currentModel
            : storeState2.currentModel
          await recordAiUsage({
            modelId: effModel,
            inputLength: textToSend.length,
            outputLength: finalContent.length,
          })
          await useAppStore.getState().refreshPointsBalance()
        } catch (e) {
          console.warn('[积分结算] 记录失败:', e)
        }
      }

      // 🧠 跨会话记忆：存储本次对话（v5.1.2修复：主聊天使用"main"作为session_id）
      // 🔧 B102修复：sessionTitle提升到外层作用域，供工作笔记功能使用
      const sessionTitle = (() => {
        if (activeExpertSessionId) {
          const s = useAppStore.getState().expertSessions.find(s => s.id === activeExpertSessionId);
          return s?.title || s?.expertName || '专家对话';
        }
        if (activeTaskSessionId) {
          const s = useAppStore.getState().taskSessions.find(s => s.id === activeTaskSessionId);
          return s?.title || '定时任务';
        }
        if (activeTaskId) {
          const s = useAppStore.getState().tasks.find(t => t.id === activeTaskId);
          return s?.title || '对话';
        }
        return '主聊天';
      })();

      if (finalContent && textToSend) {
        // 主聊天使用"main"作为持久session_id，确保跨会话记忆正常工作
        // 主聊天的ChatRequest.session_id为null→后端检索时current_sid=""→不会排除"main"记忆
        const currentSessionId = activeExpertSessionId || activeTaskSessionId || activeTaskId || 'main';
        invoke('store_cross_session_memory', {
          sessionId: currentSessionId,
          sessionTitle: sessionTitle,
          userQuery: textToSend,
          aiResponse: finalContent,
        }).catch((e: any) => {
          console.warn('[跨会话记忆] 存储失败:', e);
        });

        // 🧠 v5.5.35: 自动记录场景块到分层记忆（L2）
        const userId = localStorage.getItem('shaoziclaw_user_id') || 'default'
        invoke('store_scenario_block', {
          userId,
          sessionId: currentSessionId,
          topic: sessionTitle,
          problem: textToSend.slice(0, 500),
          solution: finalContent.slice(0, 1000),
          outcome: '已回答',
          keyFacts: [],
          tags: activeExpertType ? [activeExpertType] : [],
        }).catch((e: any) => {
          console.warn('[分层记忆] 场景块存储失败:', e);
        });
      }

      // 📝 工作笔记MD：自动检测有价值内容并保存（v5.1.3）
      if (finalContent && finalContent.length > 800 && textToSend) {
        // 启发式判断：是否存在表格/列表/标题等结构化内容
        const hasStructure = /^#{1,3}\s|\n[-*]\s|\n\d+\.\s|\|.*\|/.test(finalContent)
        // 排除简单的问候/短问答
        const isNotTrivial = textToSend.length > 15 && finalContent.length > 800
        if (hasStructure && isNotTrivial) {
          const noteTitle = (() => {
            // 优先用用户的第一个问题作为标题
            const q = textToSend.split('\n')[0].replace(/^📎.*?\n/, '').trim()
            if (q.length > 5 && q.length < 50) return q.substring(0, 40)
            // fallback：从AI回复中提取第一个标题
            const h1 = finalContent.match(/^#\s+(.+)/m)
            if (h1) return h1[1].substring(0, 40)
            return sessionTitle?.substring(0, 40) || 'AI回复笔记'
          })()
          invoke('save_working_note', {
            title: noteTitle,
            content: finalContent,
          }).catch((e: any) => {
            console.warn('[工作笔记] 自动保存失败:', e)
          })
        }
      }
    } catch (error: any) {
      const errStr = String(error || '')
      // 🛑 v5.2: 用户主动停止不显示错误（aborted 事件已处理消息）
      if (!errStr.includes('已停止生成')) {
        const errMsg = `⚠️ 请求出错：${errStr || '未知错误'}`
        if (activeExpertSessionId) {
          updateExpertMessage(activeExpertSessionId, assistantId, { content: errMsg, isThinkingComplete: true })
        } else if (activeTaskSessionId) {
          updateTaskSessionMessage(activeTaskSessionId, assistantId, { content: errMsg, isThinkingComplete: true })
        } else {
          updateMessageInActive(assistantId, { content: errMsg, isThinkingComplete: true })
        }
      }
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }
    } finally {
      setGeneratingContext(null)
    }
  }

  const shiftKeyHeld = (e: React.KeyboardEvent) => e.shiftKey

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !shiftKeyHeld(e)) { e.preventDefault(); handleSend() }
  }
  // ====== 模型选择（系统+自定义）=======
  const currentBuiltin = BUILTIN_MODELS.find(m => m.id === currentModel) || BUILTIN_MODELS[0]
  const activeCustom = customModels.find(m => m.id === activeModelId)
  const isUsingCustom = !!activeModelId && !BUILTIN_MODELS.some(m => m.id === currentModel)
  
  const currentModelInfo = isUsingCustom
    ? { id: activeCustom!.id, name: activeCustom!.name, icon: Cpu, desc: '自定义', color: '#7c3aed' }
    : currentBuiltin
  // 用于传递给子组件的判断
  const isUsingActiveCustomModel = isUsingCustom


  // ========== 🔥 关键修复：handleSend 必须在 useEffect 之前定义 ==========
  // 否则 useEffect 的回调中引用 handleSend 时，它还在 TDZ（暂时性死区）中，
  // 会抛出 ReferenceError: Cannot access 'handleSend' before initialization
  const quickQuestions = [
    '💰 菜单怎么定价合理？',
    '📊 我的门店健康度如何？',
    '🚨 遇到差评怎么处理？',
    '👥 怎么降低员工流失率？',
    '🔥 抖音上怎么推广餐厅？',
    '📍 新店选址要注意什么？',
  ]

  // 🛑 v5.2: 停止生成 — 调用后端 abort_generation 中断当前 AI 请求
  // 🛑 v5.3.4: 定时任务▶自动执行 — 更严格的守卫，避免主窗口泄漏
  // 🔧 B091: 增加hasAutoRunRef防止重复触发和阻塞手动发送
  const hasAutoRunRef = useRef(false)
  useEffect(() => {
    const state = useAppStore.getState()
    const runTask = state.pendingAutoRun
    const taskSesId = state.activeTaskSessionId
    if (!runTask || !taskSesId) return;
    if (hasAutoRunRef.current) {
      console.warn('[AutoRun] 已执行过，跳过')
      useAppStore.setState({ pendingAutoRun: null })
      return
    }

    // 🔴 防御：确保不是主窗口或专家窗口的pending
    if (state.generatingContext || state.activeExpertSessionId) {
      console.warn('[AutoRun] 跳过: generating或专家窗口活跃中')
      useAppStore.setState({ pendingAutoRun: null })
      return
    }

    console.log('[AutoRun] ✅ 检测到pendingAutoRun, taskSesId=', taskSesId, 'content=', runTask.substring(0, 60))
    // 写入前端日志
    invoke('log_frontend', { level: 'INFO', module: 'ChatArea', msg: `AutoRun触发: sesId=${taskSesId}, prompt=${runTask.substring(0, 40)}` }).catch(() => {})

    const timer = setTimeout(() => {
      const curState = useAppStore.getState()
      // 二次确认：300ms内没有被其他事件清除
      if (!curState.pendingAutoRun) {
        console.warn('[AutoRun] 跳过: pendingAutoRun已被清除')
        return
      }
      if (curState.generatingContext) {
        console.warn('[AutoRun] 跳过: 当前正在生成中')
        return
      }
      hasAutoRunRef.current = true
      console.log('[AutoRun] ⏩ 开始执行handleSend')
      handleSend(runTask)
      useAppStore.setState({ pendingAutoRun: null })
    }, 500) // 增加到500ms，给React完全渲染的时间

    return () => clearTimeout(timer)
  }, [activeTaskSessionId])


  // ========== 专家选择后初始化 ==========
  // 🔧 B008修复：greeting已由createExpertSession直接写入messages，此处只处理expertId
  useEffect(() => {
    const expertId = (window as any).__selectedExpertId
    if (expertId) {
      ;(window as any).__currentExpertName = EXPERT_NAMES[expertId] || null
    }
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const newHeight = Math.max(80, Math.min(textareaRef.current.scrollHeight, 160))
      textareaRef.current.style.height = newHeight + 'px'
    }
  }, [input])

  // 清理事件监听
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current()
        unlistenRef.current = null
      }
    }
  }, [])

  // 延伸问题点击监听（子组件MessageBubble通过CustomEvent触发）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      if (detail) handleSend(detail)
    }
    window.addEventListener('shaoziclaw-followup-click', handler)
    return () => window.removeEventListener('shaoziclaw-followup-click', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSend, generatingContext])

  // 【6】每日餐饮热点推送监听（v4.9.5: 由App.tsx在chat页面渲染后触发，直接prefill不主动send）
  // App.tsx在导航到chat后，若检测到待触发的热点事件，则prefill输入框
  // ChatArea通过window事件接收prefill指令（避免跨组件状态耦合）
  useEffect(() => {
    const handler = () => {
      // v4.9.5: 只prefill内容，不主动send，等待用户确认或App.tsx触发
      const hotspotText = '📰 请帮我做今日餐饮行业热点舆情监测，包括：热点事件名称、关键词、舆情情绪、热度指数、来源渠道';
      setInput(hotspotText);
    }
    window.addEventListener('shaoziclaw-prefill-hotspot', handler)
    return () => window.removeEventListener('shaoziclaw-prefill-hotspot', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 【7】舆情采集内容注入监听（FirecrawlPanel → 注入到对话）
  useEffect(() => {
    const handler = (e: Event) => {
      const { content, source, title } = (e as CustomEvent).detail
      if (!content) return
      const injectMsg: Message = {
        id: Math.random().toString(36).substring(2, 11),
        role: 'assistant',
        content: `📡 **${source || '舆情数据'}** — ${title || ''}\n\n${content}\n\n---\n以上是采集到的舆情数据，请基于这些真实数据，帮我分析舆情风险并给出应对建议。`,
        timestamp: new Date(),
      }
      if (activeExpertSessionId) {
        addMessageToExpertSession(activeExpertSessionId, injectMsg)
      } else {
        let taskId = activeTaskId
        if (!taskId) taskId = createTask(title || source || '舆情数据')
        addMessageToActive(injectMsg)
      }
      // 自动发送AI分析请求
      setTimeout(() => {
        setInput('基于以上舆情数据，分析舆情风险并给出应对建议')
        setTimeout(() => handleSend(), 100)
      }, 200)
    }
    window.addEventListener('shaoziclaw-inject-content', handler)
    return () => window.removeEventListener('shaoziclaw-inject-content', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExpertSessionId, activeTaskId])

  // 🎨 图片设计专家模式：渲染独立向导面板（不使用聊天界面）
  if (activeExpertType === 'image') {
    return <ImageDesignPanel />
  }

  return (
    <div className="flex-1 flex flex-col h-full" style={{ background: '#fff' }}>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ background: '#fff' }}>
        {messages.length === 0 ? (
          /* 空状态 — 纯LOGO图形突出品牌识别 */
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#E6F7EF 0%,#DFF5E9 100%)', border: '1px solid #B8E6CD' }}>
              <img src="/logo-graphic.svg" alt="勺子Claw" style={{ width: 72, height: 72 }} />
            </div>
            <h3 className="text-xl font-bold mt-5 mb-2" style={{ color: '#1a1a1a' }}>勺子Claw</h3>
            <p className="text-sm text-center max-w-md mb-8" style={{ color: '#888' }}>
              <strong style={{color:'#57CC86', fontSize: 15}}>餐饮人的超级AI大脑</strong><br />
              覆盖选址、成本、菜单、营销、运营全链路<br />
              <span style={{ fontSize: 11, color: '#bbb' }}>每一步思考过程都对你可见 ✨</span>
            </p>

            {/* 快捷问题 — 6个问题 × 3列2行 整齐排版 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-w-xl w-full">
              {quickQuestions.map((q, i) => (
                <button key={i}
                  onClick={() => { setInput(q); setTimeout(() => handleSend(), 50) }}
                  className="text-left px-3 py-2.5 rounded-xl border transition-all"
                  style={{
                    borderColor: '#f0f0f0', color: '#555', fontSize: 13,
                    background: '#fafafa',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#ccc'; e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.color = '#333' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.color = '#555' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入区 — Cursor深色风格 */}
      <div className="shrink-0 border-t" style={{ borderColor: '#f0f0f0', background: '#fff' }}>
        <style>{`.typing-dot{width:6px;height:6px;border-radius:50%;background:#999;animation:blink 1s infinite}@keyframes blink{0%,100%{opacity:.3}50%{opacity:1}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div className="max-w-4xl mx-auto p-3">
          {/* ═══ 工具栏：文件上传 | 模型选择 | 技能选择 ═══ */}
          <div className="flex items-center gap-0.5 mb-2 px-1">
            {/* 文件上传 */}
            <FileUploader />

            {/* Tab 1: 模型选择器 — 点击弹出系统+自定义模型列表 */}
            <ModelPickerTab
              currentModel={currentModelInfo}
              isCustomMode={isUsingActiveCustomModel}
              builtinModels={BUILTIN_MODELS}
              customModels={customModels}
              activeModelId={activeModelId}
              onSelectBuiltin={(modelId) => {
                setCurrentModel(modelId)
                setActiveModelId(null)
              }}
              onSelectCustom={(customId) => {
                const cm = customModels.find(m => m.id === customId)
                if (cm) {
                  setCurrentModel(cm.model || 'custom')
                  setActiveModelId(customId)
                }
              }}
              onAddCustom={() => setShowCustomModal(true)}
            />

            {/* 【4】技能选择器 — 动态弹出面板 */}
            <SkillPickerTab
              selectedSkill={selectedSkill}
              onSelectSkill={(skillId) => setSelectedSkill(skillId)}
              onClearSkill={() => setSelectedSkill(null)}
              onOpenSkillsPage={() => {
                // 触发App.tsx导航到技能市场
                const event = new CustomEvent('shaoziclaw-navigate-skills')
                window.dispatchEvent(event)
              }}
            />
            
            <div style={{ flex: 1 }} />
            
            {/* 清空 + Token计数 */}
            <button onClick={() => clearActiveMessages()} title="清空对话"
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
            <span style={{ fontSize: 11, color: '#555' }}>{(((tokenUsed.prompt || 0) + (tokenUsed.completion || 0)) / 1000).toFixed(0)}K / {(tokenLimit / 1000000).toFixed(1)}M</span>
          </div>

          {/* 📎 已上传文件 — WorkBuddy风格内联标签 + 悬停缩略图 */}
          {uploadedFiles.length > 0 && (
            <div className="mb-2 px-1">
              <div className="flex flex-wrap items-center gap-1.5 py-1.5">
                {uploadedFiles.map((file, idx) => (
                  <div key={file.id} className="relative group/tag">
                    {/* 标签本体 */}
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-default transition-all"
                      style={{
                        borderColor: file.type === 'image' ? '#A7F3D0' : '#E5E7EB',
                        background: file.type === 'image' ? '#ECFDF5' : '#F9FAFB',
                        fontSize: 12,
                        color: '#374151',
                      }}
                    >
                      {/* 图标 */}
                      {file.type === 'image' ? (
                        <span style={{ color: '#059669', fontSize: 13 }}>🖼</span>
                      ) : (
                        <FileText size={13} style={{ color: '#6B7280', flexShrink: 0 }} />
                      )}
                      {/* 文件名（截断） */}
                      <span className="max-w-[180px] truncate">{file.name}</span>
                      {/* 删除按钮 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeUploadedFile(file.id); }}
                        className="ml-0.5 rounded-full p-0.5 opacity-0 group-hover/tag:opacity-100 transition-opacity hover:bg-red-50"
                        style={{ color: '#EF4444', lineHeight: 1 }}
                      >
                        <X size={11} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* 🖼 悬停缩略图（仅图片类型） */}
                    {file.type === 'image' && file.dataUrl && (
                      <div
                        className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-xl shadow-lg overflow-hidden opacity-0 group-hover/tag:opacity-100 transition-opacity pointer-events-none"
                        style={{ background: '#fff', border: '1px solid #E5E7EB' }}
                      >
                        <img
                          src={file.dataUrl}
                          alt={file.name}
                          className="block max-w-[240px] max-h-[200px] object-contain"
                        />
                        <div className="px-2 py-1 text-xs text-gray-500 text-center whitespace-nowrap bg-white">
                          {(file.size / 1024).toFixed(0)}KB · {file.name}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {/* 清空全部 */}
                <button
                  onClick={clearUploadedFiles}
                  className="text-xs px-2 py-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  ✕ 清空
                </button>
              </div>
            </div>
          )}

          {/* 输入框 — 干净无干扰 */}
          <div className="relative flex items-end bg-white rounded-xl border transition-all"
            style={{ borderColor: '#e0e0e0', background: '#fff' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#ccc' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#e0e0e0' }}>
            <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown} placeholder={uploadedFiles.length > 0 ? "输入你的问题，文件将一起发送... (Enter 发送)" : "输入任何餐饮经营问题... (Enter 发送)"}
              rows={2} disabled={isMyWindowGenerating}
              className="flex-1 bg-transparent px-4 py-3 pr-12 resize-none focus:outline-none min-h-[80px] max-h-[160px]"
              style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }} />
            <button
              onClick={() => {
                console.log('[DIAG-B091] onClick触发')
                if (isMyWindowGenerating) { handleStop() } else { handleSend() }
              }}
              onMouseDown={() => {
                // 🔧 B091: 备用触发机制
                console.log('[DIAG-B091] onMouseDown触发')
                if (!isMyWindowGenerating && (input.trim() || uploadedFiles.length > 0)) {
                  handleSend()
                }
              }}
              disabled={!isMyWindowGenerating && (!input.trim() && uploadedFiles.length === 0)}
              className="absolute right-2 bottom-2 p-2 rounded-xl text-white transition-colors shadow-sm"
              style={isMyWindowGenerating
                ? { background: '#EF4444', cursor: 'not-allowed' }
                : ((!input.trim() && uploadedFiles.length === 0) ? { background: '#ddd', cursor: 'not-allowed' } : { background: '#57CC86', cursor: 'pointer' })
              }>
              {isMyWindowGenerating ? <Square size={14} /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-center mt-1.5" style={{ fontSize: 10, color: '#ccc' }}>
            内容由 AI 生成，请核实重要信息
          </p>
        </div>

        {/* ====== 自定义模型弹窗 ====== */}
        {showCustomModal && (
          <CustomModelModal onClose={() => setShowCustomModal(false)} onSave={(data) => {
            addCustomModel(data);
            setShowCustomModal(false);
          }} />
        )}
      </div>
    </div>
  )
}

// ============================================================
// 📎 文件附件卡片组件（带hover预览）
// ============================================================

function FileAttachmentCard({ attachment, isUser }: { attachment: any; isUser: boolean }) {
  const [showPreview, setShowPreview] = useState(false);
  const isImage = attachment.type === 'image';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 10,
        border: '1px solid #E5E7EB',
        background: isUser ? '#F5FAF7' : '#f8f8f8',
        maxWidth: 320,
        cursor: isImage ? 'pointer' : 'default',
        position: 'relative',
      }}
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      {/* 文件类型图标 */}
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: isUser ? '#e8f0ec' : '#eee',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isImage && attachment.dataUrl ? (
          <img src={attachment.dataUrl} alt={attachment.name} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />
        ) : attachment.type === 'docx' ? (
          <FileText size={18} style={{ color: '#2563EB' }} />
        ) : attachment.type === 'pdf' ? (
          <FileText size={18} style={{ color: '#DC2626' }} />
        ) : attachment.type === 'ppt' ? (
          <Presentation size={18} style={{ color: '#EA580C' }} />
        ) : (
          <File size={18} style={{ color: '#6B7280' }} />
        )}
      </div>
      {/* 文件信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1F2937', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {attachment.name}
        </p>
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '2px 0 0' }}>
          {(() => {
            const b = attachment.size;
            if (b < 1024) return `${b}B`;
            if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
            return `${(b / (1024 * 1024)).toFixed(1)}MB`;
          })()}
          {attachment.type === 'docx' && ' · Word文档'}
          {attachment.type === 'pdf' && ' · PDF'}
          {attachment.type === 'ppt' && ' · PPT'}
        </p>
      </div>
      {/* 状态标识 */}
      {attachment.type === 'docx' && attachment.content && (
        <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600, flexShrink: 0 }}>✓ 已解析</span>
      )}

      {/* Hover预览浮层 */}
      {showPreview && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          zIndex: 100,
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          padding: 12,
          marginBottom: 8,
          maxWidth: 400,
          minWidth: 280,
        }}>
          {isImage && attachment.dataUrl ? (
            <div>
              <img 
                src={attachment.dataUrl} 
                alt={attachment.name}
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 300, 
                  borderRadius: 8,
                  display: 'block'
                }} 
              />
              <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
                {attachment.name} · {(attachment.size / 1024).toFixed(1)}KB
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <FileText size={20} style={{ 
                  color: attachment.type === 'docx' ? '#2563EB' : attachment.type === 'pdf' ? '#DC2626' : '#6B7280' 
                }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1F2937', margin: 0 }}>{attachment.name}</p>
                  <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                    {(attachment.size / 1024).toFixed(1)}KB · {attachment.type?.toUpperCase() || '文件'}
                  </p>
                </div>
              </div>
              {attachment.content && (
                <div style={{ 
                  background: '#F9FAFB', 
                  borderRadius: 8, 
                  padding: 10,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 4px', fontWeight: 600 }}>内容预览：</p>
                  <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {attachment.content.substring(0, 500)}
                    {attachment.content.length > 500 && '...'}
                  </p>
                </div>
              )}
              {!attachment.content && (
                <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', padding: '20px 0' }}>
                  文件已上传，将在分析时读取内容
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ============================================================
// 消息气泡
// ============================================================

// ============================================================
// 消息气泡 — v4.3：实时思考展示 + 问答分离 + 永久记忆
// ============================================================

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<string | null>(null)
  const [showNegativeOptions, setShowNegativeOptions] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportToast, setExportToast] = useState<{type:'success'|'error', msg:string}|null>(null)
  // 🆕 延伸问题（问答分离用）
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([])
  const [followUpsVisible, setFollowUpsVisible] = useState(false)  // 🔒 v4.9.0 默认隐藏延伸问题
  // 🆕 当前思考步骤（实时滚动用）
  const thinkingRef = useRef<HTMLDivElement>(null)
  const [visibleThinkingCount, setVisibleThinkingCount] = useState(0)
  // v5.5.2: 完成后瀑布流折叠控制
  const [wfExpanded, setWfExpanded] = useState(true)  // 思考中默认展开，完成后可折叠
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())  // 单个步骤展开/折叠
  const hasSteps = !isUser && message.thinkingSteps && message.thinkingSteps.length > 0
  // 🔧 B058修复：isThinkingActive/hasThinkingDone 必须在 useEffect 之前声明（TDZ）
  const isThinkingActive = message.thinkingSteps && message.thinkingSteps.length > 0 && !message.isThinkingComplete
  const hasThinkingDone = message.thinkingSteps && message.thinkingSteps.length > 0 && message.isThinkingComplete

  // 思考开始时自动展开，完成后自动折叠
  useEffect(() => {
    if (isThinkingActive) setWfExpanded(true)
    else if (hasThinkingDone) setWfExpanded(false)
  }, [isThinkingActive, hasThinkingDone])

  // 🆕 【7】永久记忆：每条AI回答存储到localStorage
  useEffect(() => {
    if (!isUser && message.content && message.id) {
      try {
        const memoryKey = 'shaoziclaw_conversation_memory'
        const existing = JSON.parse(localStorage.getItem(memoryKey) || '[]')
        // 去重：只添加新回答
        const exists = existing.some((item: any) => item.messageId === message.id)
        if (!exists) {
          const allMsgs = useAppStore.getState().getActiveMessages()
          const userMsg = [...allMsgs].reverse().find(m => m.role === 'user')
          existing.push({
            messageId: message.id,
            question: userMsg?.content || '',
            answer: message.content,
            skill: message.skillName || null,
            timestamp: new Date().toISOString(),
          })
          // 最多保留最近500条记忆
          const trimmed = existing.slice(-500)
          localStorage.setItem(memoryKey, JSON.stringify(trimmed))
        }
      } catch(e) { /* 静默处理 */ }
    }
  }, [message.content, message.id, isUser])

  // 🆕 【5】实时思考：每当thinkingSteps更新，滚动到底部
  useEffect(() => {
    if (message.thinkingSteps && message.thinkingSteps.length > visibleThinkingCount) {
      setVisibleThinkingCount(message.thinkingSteps.length)
      thinkingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [message.thinkingSteps?.length])

  const copyContent = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true); setTimeout(()=>setCopied(false),1500)
    invoke('record_implicit_feedback', { messageId: message.id, actionType: 'copy' }).catch(()=>{})
  }

  const handleExport = async (format: 'docx' | 'pptx' | 'pdf' | 'html' | 'xlsx') => {
    setShowExportMenu(false)
    setExporting(true)
    setExportToast(null)
    try {
      // 从会话中推导标题
      const allMessages = useAppStore.getState().getActiveMessages()
      const firstUserMsg = allMessages.find(m => m.role === 'user')
      const title = firstUserMsg?.content?.substring(0, 30).replace(/[\n\r\\/:*?"<>|]/g, '') || '勺子Claw文档'

      if (!message.content || message.content.trim().length < 10) {
        setExportToast({type:'error', msg:'内容太短，无法导出'})
        return
      }

      let savedPath: string | null = null
      let formatName = ''
      let errMsg = ''
      try {
        if (format === 'docx') { savedPath = await exportToDocx(title, message.content); formatName = 'Word' }
        else if (format === 'pptx') { savedPath = await exportToPptx(title, message.content); formatName = 'PPT' }
        else if (format === 'pdf') { savedPath = await exportToPdf(title, message.content); formatName = 'PDF' }
        else if (format === 'html') { savedPath = await exportToHtml(title, message.content); formatName = 'HTML' }
        else if (format === 'xlsx') { savedPath = await exportToXlsx(title, message.content); formatName = 'Excel' }
      } catch (innerErr: any) {
        errMsg = innerErr?.message || String(innerErr) || '未知错误'
        console.error(`[ChatArea] ${formatName} 导出异常:`, innerErr)
      }

      if (savedPath) {
        const shortPath = savedPath.length > 50
          ? '...' + savedPath.slice(-47)
          : savedPath
        setExportToast({type:'success', msg:`${formatName} 已保存至:\n${shortPath}`})
        console.log(`[ChatArea] ${formatName} 导出成功 → ${savedPath}`)
      } else if (errMsg) {
        setExportToast({type:'error', msg:`${formatName} 导出失败: ${errMsg}`})
      } else {
        // savedPath = null 且无错误 → 用户取消了保存对话框
        console.log(`[ChatArea] ${formatName} 导出: 用户取消`)
      }
    } catch (err) {
      console.error('[ChatArea] Export failed:', err)
      setExportToast({type:'error', msg:`导出失败: ${err}`})
    } finally {
      setExporting(false)
      // 3秒后自动清除toast
      setTimeout(() => setExportToast(null), 3000)
    }
  }

  const submitFeedback = async (type: 'positive' | 'negative', reason?: string) => {
    setFeedbackGiven(type)
    setShowNegativeOptions(false)
    try {
      const allMessages = useAppStore.getState().getActiveMessages()
      const userMsg = [...allMessages].reverse().find(m => m.role === 'user')
      await invoke('submit_feedback', {
        messageId: message.id,
        userQuery: userMsg?.content || '',
        aiResponse: message.content,
        skillUsed: message.skillName || null,
        feedbackType: type,
        reason: reason || null,
        comment: null,
      })
    } catch(e) { /* 静默处理 */ }
  }

  // 🆕 【8】自动生成延伸问题（仅AI回答完整后）
  useEffect(() => {
    if (!isUser && message.content && !isThinkingActive && feedbackGiven === null) {
      const content = message.content.slice(0, 500)
      // 【修复】专家会话和普通任务使用不同消息源
      const { activeExpertSessionId, expertSessions } = useAppStore.getState()
      let allMessages, lastUserMsg
      if (activeExpertSessionId) {
        const session = expertSessions.find(s => s.id === activeExpertSessionId)
        allMessages = session?.messages || []
        lastUserMsg = [...allMessages].reverse().find(m => m.role === 'user')?.content || ''
      } else {
        allMessages = useAppStore.getState().getActiveMessages()
        lastUserMsg = [...allMessages].reverse().find(m => m.role === 'user')?.content || ''
      }

      const generateFollowUps = (): string[] => {
        const q = lastUserMsg.toLowerCase()
        const a = content.toLowerCase()
        
        // 🔧 工具函数：提取用户消息中的关键实体
        const extractEntity = (...keywords: string[]) => {
          for (const kw of keywords) {
            const idx = q.indexOf(kw)
            if (idx !== -1) {
              // 提取关键词前后10个字符作为上下文
              const start = Math.max(0, idx - 8)
              const end = Math.min(q.length, idx + kw.length + 10)
              return q.slice(start, end).trim()
            }
          }
          return ''
        }
        
        // 🔧 工具函数：判断是否包含多个关键词中的任一个
        const hasAny = (text: string, keywords: string[]) => keywords.some(k => text.includes(k))

        // ═══════════════ 选址类（6个子分支）══════════════
        if (hasAny(q+a, ['选址', '位置', '铺子', '商圈', '开店', '开店铺', '找地方'])) {
          const loc = extractEntity('城市', '哪个城', '在哪个', '地点')
          if (q.includes('租金') || q.includes('房租')) return ['这个位置的租金回报率怎么算？', '免租期一般能谈多久？', '转让费合理范围是多少？']
          if (q.includes('人流') || q.includes('客流') || q.includes('人流量')) return ['用什么方法测算有效人流？', '工作日和周末人流差异大怎么办？', '路过率和进店率怎么估算？']
          if (q.includes('竞品') || q.includes('竞争') || q.includes('对手')) return ['周边竞品的客单价和翻台率？', '差异化定位怎么做才能避开直接竞争？', '竞品分析需要收集哪些数据？']
          return ['这个位置适合开什么类型的店？', '租金控制在多少比较合理？', '周边竞品情况如何应对？']
        }
        
        // ═══════════════ 菜单/定价类（5个子分支）══════════════
        if (hasAny(q+a, ['菜单', '菜品', '定价', '价格', '毛利', '套餐'])) {
          if (q.includes('引流') || q.includes('爆款') || q.includes('招牌')) return ['引流款的定价策略是什么？', '怎么设计利润款组合？', '新品上架怎么测试市场反应？']
          if (q.includes('外卖菜单') || q.includes('外卖定价') || q.includes('外卖套餐')) return ['外卖菜单和堂食菜单要区分吗？', '外卖满减后还有利润吗？', '怎么设置外卖专属套餐？']
          if (q.includes('成本') || q.includes('食材成本')) return ['单品成本卡怎么制作？', '毛利率控制在多少合适？', '哪些菜是隐形亏损的？']
          return ['哪些菜品应该淘汰或替换？', '怎么设计引流款和利润款？', '外卖菜单怎么差异化？']
        }
        
        // ═══════════════ 外卖运营（7个子分支）══════════════
        if (hasAny(q+a, ['外卖', '美团', '饿了么', '淘宝闪购', '京东', '即时零售', '平台'])) {
          if (q.includes('新店') || q.includes('起步') || q.includes('起号') || q.includes('刚上')) return ['新店期怎么快速积累基础单量？', '新店活动力度多大合适？', '前30天的运营节奏怎么安排？']
          if (q.includes('限流') || q.includes('降权') || q.includes('被限') || q.includes('流量下降')) return ['限流一般持续多久能恢复？', '恢复期间还能做什么？', '怎么判断是不是真的被限流了？']
          if (q.includes('差评') || q.includes('评分') || q.includes('DSR') || q.includes('星级')) return ['差评对排名影响有多大？', '差评回复有什么技巧？', '怎么预防恶意差评？']
          if (q.includes('推广') || q.includes('点金') || q.includes('竞价') || q.includes('广告')) return ['点金推广的ROI怎么算？', '推广预算占营收多少合适？', '什么时候该加投、什么时候停投？']
          if (q.includes('违规') || q.includes('处罚') || q.includes('扣分') || q.includes('申诉')) return ['申诉通过率一般是多少？', '扣分对店铺权重影响多久？', '怎么避免再次触犯同类规则？']
          if (q.includes('满减') || q.includes('活动') || q.includes('优惠')) return ['满减公式是什么？怎么算不亏钱？', '活动和利润怎么平衡？', '多平台活动冲突怎么办？']
          return ['外卖平台扣点怎么谈？', '差评怎么处理最有效？', '满减活动怎么设置不亏钱？']
        }
        
        // ═══════════════ 营销获客（4个子分支）══════════════
        if (hasAny(q+a, ['营销', '推广', '抖音', '小红书', '大众点评', '获客', '私域'])) {
          if (q.includes('抖音') || q.includes('视频') || q.includes('直播')) return ['餐饮做短视频的核心逻辑是什么？', '怎么拍出有转化力的探店视频？', '直播带货适合餐饮吗？']
          if (q.includes('会员') || q.includes('私域') || q.includes('复购') || q.includes('留存')) return ['会员体系从零搭建需要几步？', '会员权益怎么设计才有吸引力？', '私域运营每天做什么动作？']
          if (q.includes('开业') || q.includes('活动方案') || q.includes('促销')) return ['开业活动的核心目的是什么？', '预算有限怎么做高性价比营销？', '活动结束后怎么承接流量？']
          return ['预算有限怎么做高性价比营销？', '会员体系怎么搭建？', '怎么设计开业活动方案？']
        }
        
        // ═══════════════ 成本财务（4个子分支）══════════════
        if (hasAny(q+a, ['成本', '毛利', '利润', '采购', '损耗', '食材', '财务', '盈亏'])) {
          if (q.includes('食材成本') || q.includes('原材料') || q.includes('供应链')) return ['供应商怎么筛选和分级？', '集中采购还是分散采购好？', '怎么建立食材标准成本卡？']
          if (q.includes('损耗') || q.includes('浪费') || q.includes('库存')) return ['食材损耗率正常范围是多少？', '先进先出怎么落地执行？', '怎么找出浪费的根本原因？']
          if (q.includes('人力成本') || q.includes('人效') || q.includes('薪资')) return ['餐饮人工成本占比多少健康？', '怎么计算人效指标？', '全职+兼职怎么搭配最划算？']
          return ['食材成本占比多少算健康？', '怎么降低后厨浪费？', '供应商谈判有什么技巧？']
        }
        
        // ═══════════════ 团队管理（4个子分支）══════════════
        if (hasAny(q+a, ['员工', '团队', '招聘', '培训', '排班', '留人', '薪酬', '流失'])) {
          if (q.includes('招聘') || q.includes('招人') || q.includes('缺人')) return ['去哪里招靠谱的员工？', '面试餐饮员工问什么问题？', '怎么降低新人离职率？']
          if (q.includes('排班') || q.includes('班次') || q.includes('人手')) return ['高峰期和低峰期人员怎么配？', '兼职和全职比例多少合适？', '排表工具推荐？']
          if (q.includes('薪酬') || q.includes('工资') || q.includes('提成') || q.includes('激励')) return ['底薪+提成的结构怎么设？', 'KSF绩效怎么落地到餐饮？', '发奖金还是涨工资效果好？']
          return ['怎么降低员工流失率？', '排班怎么安排最合理？', '薪酬结构怎么设计有激励性？']
        }
        
        // ═══════════════ 品类专项（6个品类）══════════════
        if (hasAny(q+a, ['火锅', '串串', '麻辣烫'])) return ['火锅的锅底成本占比多少？', '翻台率怎么提升？', '怎么设计差异化的蘸料体验？']
        if (hasAny(q+a, ['茶饮', '奶茶', '咖啡', '饮品'])) return ['一杯饮品的成本结构是怎样的？', '季节性产品怎么轮换？', '怎么提高出杯效率？']
        if (hasAny(q+a, ['烧烤', '烤肉', '烤串'])) return ['烧烤食材保鲜有什么诀窍？', '酒水怎么配比利润最高？', '夜宵时段怎么经营？']
        if (hasAny(q+a, ['快餐', '简餐', '盖饭', '面馆'])) return ['快餐出餐速度怎么做到3分钟内？', '标准化流程怎么建立？', '怎么提高翻台率？']
        
        // ═══════════════ 危机公关（3个子分支）══════════════
        if (hasAny(q+a, ['危机', '舆情', '食安', '投诉', '差评', '公关'])) {
          if (q.includes('差评') || q.includes('负面评价')) return ['差评回复模板有哪些？', '怎么判断是否恶意差评？', '差评多了怎么挽回整体评分？']
          if (q.includes('食安') || q.includes('食品安全') || q.includes('过期')) return ['食品安全事故的第一时间响应步骤？', '怎么向公众透明沟通？', '如何重建顾客信任？']
          return ['怎么预防同类问题再次发生？', '如何挽回不满的顾客？', '服务话术怎么优化提升体验？']
        }
        
        // ═══════════════ 加盟扩张（3个子分支）══════════════
        if (hasAny(q+a, ['加盟', '连锁', '扩张', '标准化', '直营'])) {
          return ['什么时候该考虑开放加盟？', '加盟商管控体系怎么建？', '标准化SOP怎么落地执行？']
        }
        
        // ═══════════════ 资本融资（3个子分支）══════════════
        if (hasAny(q+a, ['融资', '股权', '投资', '估值', '退出', '上市'])) {
          return ['餐饮项目怎么估值比较合理？', '股权分配要注意哪些坑？', '投资人最看重什么指标？']
        }

        // ═══════════════ 默认：根据回答内容动态生成 ═══════════════
        // 从AI回复中提取关键词来生成更相关的默认问题
        if (a.includes('方案') || a.includes('策略') || a.includes('建议'))
          return ['能给我一个具体的执行步骤吗？', '实施这个方案大概需要多少投入？', '有没有成功案例可以参考？']
        if (a.includes('数据') || a.includes('数字') || a.includes('%') || a.includes('元'))
          return ['这些数据适用于我的品类吗？', '怎么获取我门店的这些数据？', '数据异常时怎么排查原因？']
        if (a.includes('步骤') || a.includes('流程') || a.includes('方法'))
          return ['执行中可能遇到什么困难？', '有没有工具或模板可以辅助？', '怎么衡量执行效果？']
          
        // 终极兜底
        return ['能给我一个具体的执行步骤吗？', '这个方案大概需要多少投入？', '有没有成功案例可以参考？']
      }

      setFollowUpQuestions(generateFollowUps())
      // setFollowUpsVisible(true)  // 🔒 v4.9.0 默认隐藏，不自动展开
    }
  }, [message.content, isThinkingActive, isUser])

  // v5.5.3: 阶段感知样式映射 — 不同phase不同颜色和图标
  const getPhaseStyle = (stepType: string, title?: string) => {
    const t = title || ''
    switch (stepType) {
      case 'thinking': return { icon: '🧠', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)' }
      case 'intent': return { icon: '🎯', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' }
      case 'plan': return { icon: '📋', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' }
      case 'tool': return { icon: '🔧', color: '#22c55e', bg: 'rgba(34,197,94,0.06)' }
      case 'tool_done': return { icon: '✅', color: '#22c55e', bg: 'rgba(34,197,94,0.04)' }
      case 'tool_error': return { icon: '⚠️', color: '#ef4444', bg: 'rgba(239,68,68,0.06)' }
      case 'synthesize': return { icon: '✨', color: '#ec4899', bg: 'rgba(236,72,153,0.08)' }
      case 'reasoning': case 'deepseek_reasoning': return { icon: '🤔', color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' }
      default: return { icon: '·', color: '#6b7280', bg: 'rgba(107,114,128,0.04)' }
    }
  }

  return (
    <>
      {/* ═══ v5.5.3: 瀑布流重构 — 6阶段真推理展示 ═══ */}
      {hasSteps && (
        <div className="wf-container" style={{ padding: '2px 0' }}>
          {/* 思考完成后显示折叠摘要 */}
          {hasThinkingDone && !wfExpanded && (
            <div className="wf-summary" onClick={() => setWfExpanded(true)}>
              <span className={`wf-summary-chevron ${wfExpanded ? 'wf-summary-chevron--open' : ''}`}>▾</span>
              <span>🧠 思考过程（{message.thinkingSteps!.length} 步）</span>
            </div>
          )}

          {/* 瀑布流步骤列表 */}
          {(isThinkingActive || wfExpanded) && message.thinkingSteps && message.thinkingSteps.length > 0 && (
            <>
              {hasThinkingDone && (
                <div className="wf-summary" onClick={() => setWfExpanded(false)} style={{ marginBottom: 4 }}>
                  <span className={`wf-summary-chevron wf-summary-chevron--open`}>▾</span>
                  <span>🧠 思考过程（{message.thinkingSteps!.length} 步）</span>
                </div>
              )}
              <div ref={thinkingRef}>
                {message.thinkingSteps
                  // v5.5.3: tool_done覆盖tool卡片（同一个工具的开始和完成合并展示）
                  .reduce((acc: ThinkingStep[], step, idx) => {
                    if (step.stepType === 'tool_done' || step.stepType === 'tool_error') {
                      // 向前查找同名tool卡片并用完成状态覆盖
                      const toolTitle = step.title?.replace(/^[✅⚠️]\s*/, '')
                      const prevIdx = acc.findIndex((s, i) =>
                        (s.stepType === 'tool') &&
                        (s.title?.replace(/^[🌐🗺️📁📚🧠🔍]\s*/, '') === toolTitle ||
                         step.title?.includes(s.title?.replace(/^[^✅⚠️]*$/, '') || ''))
                      )
                      if (prevIdx >= 0) {
                        acc[prevIdx] = { ...step, stepType: step.stepType === 'tool_done' ? 'tool_done' : 'tool_error' }
                        return acc
                      }
                    }
                    acc.push(step)
                    return acc
                  }, [])
                  .map((step, idx) => {
                    const isLast = idx === message.thinkingSteps!.length - 1
                    const isExpanded = expandedSteps.has(idx)
                    const hasContent = step.content && step.content.length > 0

                    // v5.5.3: 阶段感知样式
                    const phaseInfo = getPhaseStyle(step.stepType, step.title)
                    const isRunning = isThinkingActive && isLast && ['thinking', 'tool', 'synthesize'].includes(step.stepType)
                    const isDone = !isRunning && step.stepType !== 'tool_error'
                    const isError = step.stepType === 'tool_error'

                    const statusClass = isError ? 'wf-card--error'
                      : isRunning ? 'wf-card--running'
                      : 'wf-card--done'

                    return (
                      <div
                        key={step.id || idx}
                        className={`wf-card ${statusClass} wf-phase-${step.stepType}`}
                        onClick={() => hasContent && setExpandedSteps(prev => {
                          const next = new Set(prev)
                          if (next.has(idx)) next.delete(idx)
                          else next.add(idx)
                          return next
                        })}
                        style={{
                          animationDelay: `${idx * 0.04}s`,
                          marginBottom: 3,
                        }}
                      >
                        {/* 状态图标 */}
                        <div className={`wf-icon ${isRunning ? 'wf-icon--running' : isError ? 'wf-icon--error' : 'wf-icon--done'}`}>
                          {isError ? '⚠'
                            : isRunning ? <div className="wf-spinner" />
                            : '✓'}
                        </div>

                        {/* 标题 + 详情 */}
                        <div className="wf-body">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`wf-title ${isRunning ? 'wf-title-running' : ''}`}
                              style={{ fontWeight: 500 }}>
                              {phaseInfo.icon} {step.title}
                            </span>
                            {isRunning && (
                              <span className="wf-badge" style={{ color: phaseInfo.color, background: phaseInfo.bg }}>
                                {step.stepType === 'thinking' ? '思考中' :
                                 step.stepType === 'synthesize' ? '生成中' : '执行中'}
                              </span>
                            )}
                            {hasContent && (
                              <span className={`wf-chevron ${isExpanded ? 'wf-chevron--open' : ''}`}>▾</span>
                            )}
                          </div>
                          {/* 展开的详情内容 */}
                          {isExpanded && hasContent && (
                            <div className="wf-detail">
                              {step.content}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 消息气泡 ═══ */}
      <div className={`flex gap-3 ${isUser ? 'justify-end' : ''}`} style={{ padding: '4px 0' }}>
      {!isUser && (
        <div style={{ width:34,height:34,borderRadius:'50%',background:'#FFFFFF',border:'1px solid #E8F5EC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,overflow:'hidden' }}>
          <img src="/logo-graphic.svg" alt="勺子Claw" style={{width:26,height:26}} />
        </div>
      )}
      <div className={`max-w-[82%] ${isUser ? 'order-first' : ''}`}>
        <div className={`px-4 py-3`}
          style={isUser ? {
            background:'#F5FAF7',color:'#333',borderRadius:18,borderTopRightRadius:4,border:'none'
          } : {
            background:'#FFFFFF',color:'#222',borderRadius:18,borderTopLeftRadius:4,border:'1px solid #f0f0f0'
          }}>

          {/* Skill 标签 */}
          {message.skillName && (
            <div style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600,color:'#1A7D4E',background:'#E6F7EF',border:'1px solid #B8E6CD',marginBottom:6 }}>
              ✨ {message.skillName.replace(/^(L[0-3]-)/,'')}
            </div>
          )}

          {/* 📚 RAG知识库引用标签（v5.1） */}
          {message.ragSources && message.ragSources.length > 0 && !isUser && (
            <div style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:6,fontSize:10,fontWeight:600,color:'#2563EB',background:'#DBEAFE',border:'1px solid #93C5FD',marginBottom:6,marginLeft: message.skillName ? 4 : 0 }}>
              📚 参考了知识库
            </div>
          )}

          {/* ════════════════════════════════════════
              消息正文
              ════════════════════════════════════════ */}
          {isUser ? (
            <p style={{ fontSize:14,lineHeight:1.65,whiteSpace:'pre-wrap',margin:0 }}>{message.content}</p>
          ) : (
            message.content ? (
              <div style={{ fontSize:14,lineHeight:1.75 }} dangerouslySetInnerHTML={{ __html: renderMarkdownEnhanced(message.content) }} />
            ) :
            isThinkingActive ? null :
            <div style={{ minHeight: 24, borderRadius: 6, animation: 'shimmer 1.5s infinite' }}>
                <style>{`@keyframes shimmer{0%{background:#f0f0f0}50%{background:#e8e8e8}100%{background:#f0f0f0}}`}</style>
            </div>
          )}
          
          {/* 📎 文件附件卡片 — WorkBuddy风格 */}
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
              {message.attachments.map(att => (
                <FileAttachmentCard key={att.id} attachment={att} isUser={isUser} />
              ))}
            </div>
          )}

          {/* 操作栏：时间 + 反馈 */}
          <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:8,paddingTop:4,fontSize:10,color:isUser?'#1A7D4E':'#BBB' }}>
            <span>{new Date(message.timestamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</span>
            {message.tokensUsed&&<span>{message.tokensUsed} tokens</span>}
            {!isUser && message.content && !isThinkingActive && (
              <>
                {feedbackGiven ? (
                  <span style={{marginLeft:'auto',fontSize:10,color:feedbackGiven==='positive'?'#1A7D4E':'#888',fontWeight:500}}>
                    {feedbackGiven==='positive'?'✓ 已反馈':'已记录'}
                  </span>
                ) : showNegativeOptions ? (
                  <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
                    <button onClick={()=>submitFeedback('negative','wrong')} style={{padding:'2px 6px',borderRadius:4,border:'1px solid #E5E5E5',background:'transparent',color:'#888',fontSize:9,cursor:'pointer',transition:'all 0.15s'}}
                      onMouseEnter={(e)=>{(e.currentTarget).style.background='#F5F5F5'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}>内容错误</button>
                    <button onClick={()=>submitFeedback('negative','harmful')} style={{padding:'2px 6px',borderRadius:4,border:'1px solid #E5E5E5',background:'transparent',color:'#888',fontSize:9,cursor:'pointer',transition:'all 0.15s'}}
                      onMouseEnter={(e)=>{(e.currentTarget).style.background='#F5F5F5'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}>违规/有害</button>
                    <button onClick={()=>submitFeedback('negative','irrelevant')} style={{padding:'2px 6px',borderRadius:4,border:'1px solid #E5E5E5',background:'transparent',color:'#888',fontSize:9,cursor:'pointer',transition:'all 0.15s'}}
                      onMouseEnter={(e)=>{(e.currentTarget).style.background='#F5F5F5'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}>答非所问</button>
                    <button onClick={()=>{setShowNegativeOptions(false);setFeedbackGiven(null)}} style={{padding:'2px 8px',borderRadius:4,border:'none',background:'transparent',color:'#AAA',fontSize:9,cursor:'pointer'}}>取消</button>
                  </div>
                ) : (
                  <div style={{marginLeft:'auto',display:'flex',gap:4,alignItems:'center'}}>
                    <button onClick={()=>submitFeedback('positive')} title="这个回答有帮助"
                      onMouseEnter={(e)=>{(e.currentTarget).style.background='#f0f0f0'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}
                      style={{display:'flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:6,border:'1px solid #eaeaea',background:'transparent',cursor:'pointer',transition:'all 0.15s',fontSize:11,color:'#666',fontWeight:400}}>
                      ✓ 有帮助
                    </button>
                    <button onClick={()=>setShowNegativeOptions(true)} title="需要改进"
                      onMouseEnter={(e)=>{(e.currentTarget).style.background='#F5F5F5'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}
                      style={{display:'flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:6,border:'1px solid #E5E5E5',background:'transparent',cursor:'pointer',transition:'all 0.15s',fontSize:11,color:'#888',fontWeight:400}}>
                      需改进
                    </button>
                    <button onClick={copyContent} title="复制" style={{background:'none',border:'none',cursor:'pointer',opacity:0.25,padding:2,transition:'opacity 0.15s'}}
                      onMouseEnter={(e)=>{(e.currentTarget).style.opacity=0.6}} onMouseLeave={(e)=>{(e.currentTarget).style.opacity=0.25}}>
                      {copied?<span style={{color:'#22c55e',fontSize:11}}>✓</span>:<Copy size={12}/>}
                    </button>
                    <div style={{position:'relative'}}>
                      {/* 🔧 v5.3.8: 导出按钮更显眼 — 品牌色边框+文字标签 */}
                      <button onClick={()=>setShowExportMenu(!showExportMenu)} title="导出为 Word/PPT/PDF"
                        style={{
                          background: showExportMenu ? '#f0fdf4' : 'transparent',
                          border: `1px solid ${showExportMenu ? '#57CC86' : 'transparent'}`,
                          borderRadius: 6,
                          cursor: exporting ? 'wait' : 'pointer',
                          padding: '3px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.2s',
                          opacity: exporting ? 0.6 : 1,
                        }}
                        onMouseEnter={(e)=>{if(!exporting){e.currentTarget.style.background='#f0fdf4'; e.currentTarget.style.borderColor='#57CC86'}}}
                        onMouseLeave={(e)=>{if(!showExportMenu){e.currentTarget.style.background='transparent'; e.currentTarget.style.borderColor='transparent'}}}>
                        {exporting
                          ? <span style={{display:'inline-flex',animation:'spin 1s linear infinite'}}><Loader2 size={14}/></span>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#57CC86" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        <span style={{fontSize: 11, color: '#57CC86', fontWeight: 500}}>导出</span>
                      </button>
                      {showExportMenu && (
                        <div style={{position:'absolute',bottom:'calc(100% + 4px)',right:0,background:'#fff',borderRadius:8,border:'1px solid #e5e7eb',boxShadow:'0 4px 12px rgba(0,0,0,0.1)',padding:4,zIndex:50,display:'flex',flexDirection:'column',gap:2,minWidth:110}}>
                          {([
                            {label:'Word 文档',icon:'📄',format:'docx' as const},
                            {label:'Excel 表格',icon:'📊',format:'xlsx' as const},
                            {label:'HTML 网页',icon:'🌐',format:'html' as const},
                          ]).map(item=>(
                            <button key={item.format} onClick={()=>handleExport(item.format)}
                              style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',border:'none',background:'transparent',cursor:'pointer',borderRadius:6,fontSize:12,color:'#333',transition:'background 0.1s',whiteSpace:'nowrap'}}
                              onMouseEnter={(e)=>{(e.currentTarget).style.background='#f5f5f5'}} onMouseLeave={(e)=>{(e.currentTarget).style.background='transparent'}}>
                              <span>{item.icon}</span>
                              <span>{item.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* 导出结果toast */}
                      {exportToast && (
                        <div style={{position:'absolute',bottom:'calc(100% + 4px)',right:0,background:exportToast.type==='success'?'#f0fdf4':'#fef2f2',border:`1px solid ${exportToast.type==='success'?'#bbf7d0':'#fecaca'}`,borderRadius:6,padding:'6px 12px',fontSize:11,color:exportToast.type==='success'?'#166534':'#991b1b',whiteSpace:'nowrap',zIndex:60,boxShadow:'0 2px 8px rgba(0,0,0,0.08)',animation:'fadeIn 0.2s ease'}}>
                          {exportToast.type==='success'?'✓':'✗'} {exportToast.msg}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {(isUser || !message.content || isThinkingActive) && <span style={{marginLeft:'auto'}} />}
          </div>

          {/* ════════════════════════════════════════
              💡 延伸问题 — 独立区域，与操作栏分离
              ════════════════════════════════════════ */}
          {!isUser && message.content && !isThinkingActive && followUpQuestions.length > 0 && followUpsVisible && (
            <div style={{
              marginTop: 10,
              padding: '12px 0 0',
              borderTop: '1px dashed #E5E7EB',
            }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 10, fontWeight: 600, letterSpacing: 0.5 }}>
                💡 继续追问
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {followUpQuestions.map((fq, idx) => (
                  <button key={idx} onClick={() => {
                    const event = new CustomEvent('shaoziclaw-followup-click', { detail: fq })
                    window.dispatchEvent(event)
                  }} style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid #E5E7EB',
                    background: '#FAFAFA',
                    color: '#4B5563',
                    fontSize: 13,
                    lineHeight: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.background = '#f0f0f0';
                    el.style.borderColor = '#ccc';
                    el.style.color = '#1a1a1a';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.background = '#FAFAFA';
                    el.style.borderColor = '#E5E7EB';
                    el.style.color = '#4B5563';
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#E6F7EF', border: '1px solid #B8E6CD',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: '#1A7D4E', flexShrink: 0,
                    }}>{idx + 1}</span>
                    <span>{fq}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {isUser && (
        <div style={{ width:32,height:32,borderRadius:'50%',background:'#E8E8EE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#aaa',flexShrink:0 }}>
          {(message.content||'?')[0]}
        </div>
      )}
    </div>
    </>
  )
}

// ============================================================
// 🔥 模型选择器 Tab（模仿WorkBuddy弹窗风格）
// ============================================================

interface ModelPickerTabProps {
  currentModel: { id: string; name: string; icon: any; desc: string; color: string }
  isCustomMode: boolean
  builtinModels: typeof BUILTIN_MODELS
  customModels: { id: string; name: string; provider: string; model: string; apiBase: string }[]
  activeModelId: string | null
  onSelectBuiltin: (id: string) => void
  onSelectCustom: (id: string) => void
  onAddCustom: () => void
}

function ModelPickerTab({
  currentModel, isCustomMode, builtinModels, customModels,
  activeModelId, onSelectBuiltin, onSelectCustom, onAddCustom,
}: ModelPickerTabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAutoMode, setShowAutoMode] = useState(false)

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return
    const handler = () => setIsOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [isOpen])

  const CurrentIcon = currentModel.icon

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
        style={{ color: '#555', border: '1px solid #e0e0e0', background: '#FAFAFA' }}
        title={`当前模型: ${currentModel.name}`}
      >
        <Cpu size={14} style={{ color: '#57CC86' }} />
        <span>模型</span>
        <ChevronDown size={12} className="text-gray-400" />
      </button>

      {/* 弹出面板 — 模仿WorkBuddy模型选择器 */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 w-[320px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ border: '1px solid #eaeaea' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 头部：自动模式开关 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: '#f0f0f0' }}>
            <span className="text-xs font-semibold text-gray-700">自动模式</span>
            <button
              onClick={() => setShowAutoMode(!showAutoMode)}
              className={`w-10 h-5 rounded-full transition-all relative ${showAutoMode ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showAutoMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {/* 内置模型 */}
          <div className="py-1">
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">内置模型</p>
            {!showAutoMode && (
              <button onClick={() => { onSelectBuiltin('auto'); setIsOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#E6F7EF] transition-colors ${currentModel.id === 'auto' && !isCustomMode ? 'bg-[#E6F7EF]' : ''}`}>
                <Sparkles size={16} style={{ color: '#888' }} />
                <div><p className="text-[13px]" style={{ fontWeight: currentModel.id==='auto'&& !isCustomMode ? 600 : 400, color: '#555' }}>Auto</p></div>
              </button>
            )}
            {builtinModels.map((m) => {
              const Icon = m.icon
              return (
                <button key={m.id} onClick={() => { onSelectBuiltin(m.id); setIsOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#E6F7EF] transition-colors ${currentModel.id===m.id && !isCustomMode?'bg-[#E6F7EF]':''}`}>
                  <Icon size={16} style={{ color: m.color }} />
                  <div className="flex-1">
                    <p className="text-[13px]" style={{ fontWeight: currentModel.id===m.id&&!isCustomMode?600:400, color: currentModel.id===m.id&&!isCustomMode?'#1a1a1a':'#444' }}>
                      {m.name}
                    </p>
                    <p className="text-[11px] text-gray-400">{m.desc}</p>
                  </div>
                  {activeModelId === null && currentModel.id === m.id && (
                    <Check size={14} color="#57CC86" />
                  )}
                </button>
              )
            })}
          </div>

          {/* 自定义模型 */}
          <div className="border-t" style={{ borderColor: '#f0f0f0' }}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">自定义模型</p>
            
            {customModels.map((cm) => (
              <button key={cm.id} onClick={() => { onSelectCustom(cm.id); setIsOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-purple-50 transition-colors ${activeModelId===cm.id?'bg-purple-50':''}`}>
                <Cpu size={16} style={{ color: '#7c3aed' }} />
                <div className="flex-1">
                  <p className="text-[13px]" style={{ fontWeight: activeModelId===cm.id?600:400, color: activeModelId===cm.id?'#1a1a1a':'#444' }}>{cm.name}</p>
                  <p className="text-[11px] text-gray-400">{cm.model} · {cm.apiBase.replace(/^https?:\/\//,'')}</p>
                </div>
                {activeModelId === cm.id && <Check size={14} color="#7c3aed" />}
                {/* 删除按钮 */}
                <button onClick={(e)=>{ e.stopPropagation(); if(confirm('确定删除此模型？')) useAppStore.getState().removeCustomModel(cm.id) }}
                  className="p-1 hover:bg-red-50 rounded">
                  <X size={12} color="#ef4444"/>
                </button>
              </button>
            ))}
            
            {/* 添加自定义模型按钮 */}
            <button onClick={() => { onAddCustom(); setIsOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-gray-500 hover:text-purple-600 hover:bg-purple-50/30 transition-colors">
              <Plus size={15} />
              <span className="text-[13px]">添加自定义模型</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 🆕 自定义模型弹窗
// ============================================================

function CustomModelModal({ onClose, onSave }: { onClose: () => void; onSave: (data: { name: string; apiKey: string; apiBase: string; model: string }) => void }) {
  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiBase, setApiBase] = useState('')
  const [model, setModel] = useState('')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-[480px] bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ border: '1px solid #eaeaea' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: '#f0f0f0' }}>
          <h3 className="text-base font-bold text-gray-900">🔧 添加自定义模型</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* 表单 */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">显示名称</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="如：我的GPT-4o、Claude Sonnet"
                   className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                   style={{ border:'1px solid #eaeaea', background:'#fafafa' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">API Key</label>
            <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-..."
                   className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
                   style={{ border:'1px solid #eaeaea', background:'#fafafa' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">API 地址 (API Base URL)</label>
            <input value={apiBase} onChange={e=>setApiBase(e.target.value)} placeholder="如：https://api.openai.com/v1"
                   className="w-full px-3 py-2.5 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-300"
                   style={{ border:'1px solid #eaeaea', background:'#fafafa' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">模型名称 (Model ID)</label>
            <input value={model} onChange={e=>setModel(e.target.value)} placeholder="如：gpt-4o、claude-3.5-sonnet、deepseek-chat"
                   className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                   style={{ border:'1px solid #eaeaea', background:'#fafafa' }} />
          </div>

          <div className="rounded-lg p-3 flex items-start gap-2.5" style={{ background: '#E6F7EF', border: '1px solid #B8E6CD' }}>
            <Settings size={15} className="shrink-0 mt-0.5" style={{ color: '#1A7D4E' }} />
            <div className="text-[11px] leading-relaxed" style={{ color: '#1A7D4E' }}>
              <strong>提示：</strong>支持 OpenAI 兼容格式的 API。填写后可在对话中切换使用此模型。API Key 安全存储在本地。
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 flex justify-end gap-2.5 border-t" style={{ borderColor: '#f0f0f0' }}>
          <button onClick={onClose}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            取消
          </button>
          <button onClick={()=>{ if(name&&apiKey&&apiBase&&model){ onSave({name, apiKey, apiBase, model}) } else{ alert('请填写完整信息') } }}
                  className="px-5 py-2 rounded-lg text-[13px] font-medium text-white shadow-sm"
                  style={{ background: '#57CC86' }}>
            ✅ 确认添加
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Markdown 渲染器 + 辅助函数


// ── 已迁移到 src/utils/markdown.ts，此处通过 import { renderMarkdownEnhanced } 引入 ──

// ============================================================
// 【4】技能选择器 Tab — 动态弹出面板（支持搜索+选择+跳转技能市场）
// ============================================================

interface SkillPickerTabProps {
  selectedSkill: string | null
  onSelectSkill: (skillId: string) => void
  onClearSkill: () => void
  onOpenSkillsPage: () => void
}

// 【4】全量167个Skill数据（从SkillsPage.tsx复制）
const ALL_SKILLS: { id: string; name: string; desc: string; module: string }[] = [
  // L0 通用工具
  { id: 'catering-data-analyzer', name: '餐饮数据分析', desc: '多维度数据采集、清洗、分析与可视化呈现', module: 'L0' },
  { id: 'catering-document-generator', name: '餐饮文档生成', desc: '智能生成合同、报告、SOP等餐饮企业常用文档模板', module: 'L0' },
  { id: 'catering-knowledge-base', name: '餐饮知识库查询', desc: '连接餐饮行业知识库，解答经营中的专业问题', module: 'L0' },
  { id: 'catering-trend-monitor', name: '餐饮热点监测', desc: '实时追踪行业热点、竞品动态、政策变化', module: 'L0' },
  { id: 'ai-catering-toolkit', name: 'AI餐饮工具箱', desc: '集成多款AI工具，覆盖写作、设计、数据分析等日常办公场景', module: 'L0' },
  // M1 品牌定位
  { id: 'L1-brand-positioning', name: '品牌定位分析', desc: '餐饮品牌定位全案策划与诊断', module: 'M1' },
  { id: '品类战略与选择', name: '品类战略与选择', desc: '餐饮品类战略规划与选择决策支持', module: 'M1' },
  { id: 'L2-super-symbol', name: '超级符号设计', desc: '品牌超级符号系统构建与视觉落地', module: 'M1' },
  // M2 营运服务
  { id: 'L1-qscv-standard', name: 'QSCV标准体系', desc: '餐饮门店标准化运营管理体系', module: 'M2' },
  { id: 'L1-store-standard', name: '门店运营标准', desc: '开店/打烊SOP、值班管理、卫生清洁', module: 'M2' },
  { id: 'L1-customer-complaint', name: '客户投诉处理', desc: '顾客投诉处理、差评挽回与客服体系搭建', module: 'M2' },
  { id: 'L1-service-mot', name: '服务MOT管理', desc: '关键时刻服务设计，提升顾客满意度', module: 'M2' },
  // M3 品牌宣传
  { id: 'L1-promotion', name: '促销活动策划', desc: '餐饮营销活动全案策划与执行', module: 'M3' },
  { id: 'L1-digital-operation', name: '数字化运营', desc: '美团/抖音/小红书等平台运营策略', module: 'M3' },
  { id: 'L1-douyin-content', name: '抖音内容运营', desc: '短视频拍摄、直播带货、流量获取', module: 'M3' },
  // M4 食品安全
  { id: 'L1-food-safety', name: '食品安全管控', desc: '食安标准、证照办理、日常巡检', module: 'M4' },
  // M5 选址评估
  { id: 'location-thousand-score', name: '千分选址方法论', desc: '1000分制量化评估餐饮选址', module: 'M5' },
  { id: 'district-assessment', name: '商圈评估实战', desc: '商圈分类、客流测算、竞争密度评估', module: 'M5' },
  // M6 空间设计
  { id: 'space-efficiency-design', name: '动线分析工具', desc: '餐饮空间动线设计与效率优化', module: 'M6' },
  // M7 人力资源
  { id: '餐饮HR管理体系', name: '餐饮HR管理', desc: '招聘实战、培训体系、绩效管理', module: 'M7' },
  { id: '排班优化系统', name: '排班优化', desc: '餐饮排班全流程优化方案', module: 'M7' },
  { id: '薪酬绩效设计方案', name: '薪酬绩效设计', desc: '餐饮薪酬体系与绩效考核完整方案', module: 'M7' },
  { id: '店长培训与管理', name: '店长培训', desc: '餐饮店长从入门到精通的完整培训体系', module: 'M7' },
  // M8 企业文化
  { id: '麦当劳标准化培训体系', name: '麦当劳培训', desc: '全球最强餐饮标准化培训体系的系统解密', module: 'M8' },
  { id: 'L2-team-culture', name: '团队文化塑造', desc: '餐饮企业文化搭建与员工归属感培养', module: 'M8' },
  // M9 门头优化
  { id: 'L2-signage-design', name: '门头设计优化', desc: '门头招牌设计、菜单陈列、视觉传达', module: 'M9' },
  // M10 库存管理
  { id: 'inventory-optimization', name: '库存管理优化', desc: '仓储规划、库存分类、订货策略', module: 'M10' },
  { id: 'supply-chain-inventory', name: '供应链库存', desc: '多级库存、需求预测、跨店调拨', module: 'M10' },
  // M11 扩张发展
  { id: 'L2-new-store-opening', name: '新店开业流程', desc: '开店筹备、装修管理、设备采购', module: 'M11' },
  { id: 'L2-franchise-design', name: '加盟体系设计', desc: '加盟模式选择、标准输出、管控体系', module: 'M11' },
  // M12 门店标准
  { id: 'L2-store-checkup', name: '门店健康体检', desc: '门店运营健康度诊断与提升方案', module: 'M12' },
  { id: 'L2-table-turn', name: '翻台率优化', desc: '翻台率核心指标与时段运营策略', module: 'M12' },
  // M13 风水评测
  { id: 'L3-exit-strategy', name: '风水选址评估', desc: '选址风水分析与规避建议', module: 'M13' },
  // M14 采购供应
  { id: '采购实战指南', name: '采购实战指南', desc: '餐饮采购全流程实战指南', module: 'M14' },
  { id: 'procurement-supply-chain', name: '供应链管理', desc: '供应商生命周期管理与战略采购', module: 'M14' },
  // M15 法务合规
  { id: 'license-permit-guide', name: '证照办理指南', desc: '餐饮开店证照办理与合规指南', module: 'M15' },
  { id: 'L1-legal-compliance', name: '法律合规咨询', desc: '餐饮法律风险防控与合规管理', module: 'M15' },
  // 外卖运营
  { id: 'waimai-operation-system', name: '外卖运营系统', desc: '外卖全链路运营能力构建', module: '外卖' },
  { id: 'waimai-promotion-strategy', name: '外卖活动策划', desc: '满减/折扣/券/新客等多类型活动设计', module: '外卖' },
  { id: 'meituan-rules-compliance', name: '美团规则攻略', desc: '美团外卖规则全攻略', module: '外卖' },
  // 财务管控
  { id: '现金流管理体系', name: '现金流管理', desc: '餐饮企业现金流全流程管理方案', module: '财务' },
  { id: 'fn-cost-control', name: '成本精细化管控', desc: '采购五控法、食材标准成本卡体系', module: '财务' },
  { id: 'fn-financial-report', name: '财务报表解读', desc: '餐饮财务报表解读与经营分析', module: '财务' },
  { id: '财务会计体系', name: '财务会计体系', desc: '餐饮财务会计完整体系', module: '财务' },
  // 危机公关
  { id: 'brand-recovery', name: '品牌危机修复', desc: '餐饮品牌危机后修复与重生系统', module: '危机' },
  { id: 'L2-public-opinion-monitoring', name: '舆情监测与应对', desc: '餐饮品牌全网舆情监测体系', module: '危机' },
  // 战略融资
  { id: 'L3-brand-strategy', name: '品牌战略规划', desc: '品牌战略顶层设计与长期规划', module: '战略' },
  { id: 'L3-investment-model', name: '投资回报模型', desc: '餐饮项目投资回报分析与决策模型', module: '战略' },
  // 数据分析
  { id: 'L1-data-dashboard', name: '数据看板与经营分析', desc: '餐饮日常经营数据看板与分析体系', module: '数据' },
  { id: 'data-dashboard-guide', name: 'BI看板搭建', desc: '餐饮经营数据指标体系与数据看板设计规范', module: '数据' },
]

// 按模块分组
const SKILL_MODULES = [
  { name: '全部', key: 'all' },
  { name: 'L0通用', key: 'L0' },
  { name: '品牌', key: 'M1' },
  { name: '运营', key: 'M2' },
  { name: '营销', key: 'M3' },
  { name: '外卖', key: '外卖' },
  { name: '财务', key: '财务' },
  { name: '人力', key: 'M7' },
  { name: '选址', key: 'M5' },
]

function SkillPickerTab({ selectedSkill, onSelectSkill, onClearSkill, onOpenSkillsPage }: SkillPickerTabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeModule, setActiveModule] = useState('all')

  // 过滤技能
  const filteredSkills = ALL_SKILLS.filter(skill => {
    const matchModule = activeModule === 'all' || skill.module === activeModule
    const matchSearch = !searchQuery || 
      skill.name.includes(searchQuery) || 
      skill.desc.includes(searchQuery) ||
      skill.id.includes(searchQuery)
    return matchModule && matchSearch
  })

  // 获取已选技能的中文名
  const selectedSkillName = selectedSkill
    ? ALL_SKILLS.find(s => s.id === selectedSkill)?.name || selectedSkill.replace(/^(L[0-3]-)/, '')
    : null

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return
    const handler = () => setIsOpen(false)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [isOpen])

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      {/* 【4】按钮：根据是否选中显示不同样式 */}
      {selectedSkill ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
          style={{ color: '#1A7D4E', background: '#E6F7EF', border: '1px solid #B8E6CD' }}
        >
          🔧 {selectedSkillName}
          <ChevronDown size={12} className="text-gray-500" />
          <button onClick={(e) => { e.stopPropagation(); onClearSkill() }} style={{ marginLeft: 2, fontWeight: 700, color: '#1A7D4E', cursor: 'pointer' }}>&times;</button>
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all"
          style={{ color: '#666', border: '1px solid #eaeaea', background: '#fff' }}
        >
          🔧 技能
          <ChevronDown size={12} className="text-gray-400" />
        </button>
      )}

      {/* 【4】弹出面板 */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 w-[400px] bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
          style={{ border: '1px solid #eaeaea' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 搜索框 */}
          <div className="p-3 border-b" style={{ borderColor: '#f0f0f0' }}>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#fafafa', border: '1px solid #eaeaea' }}>
              <Search size={14} className="text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索技能..."
                className="flex-1 text-[13px] bg-transparent focus:outline-none"
                style={{ color: '#333' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 模块标签 */}
          <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto" style={{ borderBottom: '1px solid #f0f0f0' }}>
            {SKILL_MODULES.map(mod => (
              <button
                key={mod.key}
                onClick={() => setActiveModule(mod.key)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all"
                style={activeModule === mod.key
                  ? { background: '#57CC86', color: '#fff' }
                  : { background: '#fafafa', color: '#666' }}
              >
                {mod.name}
              </button>
            ))}
          </div>

          {/* 技能列表 */}
          <div className="max-h-[300px] overflow-y-auto py-1">
            {filteredSkills.length === 0 ? (
              <div className="text-center py-6 text-[13px] text-gray-400">未找到匹配的技能</div>
            ) : (
              filteredSkills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => {
                    onSelectSkill(skill.id)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-[#E6F7EF] transition-colors ${selectedSkill === skill.id ? 'bg-[#E6F7EF]' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium" style={{ color: selectedSkill === skill.id ? '#1a1a1a' : '#444' }}>
                      {skill.name}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">{skill.desc}</p>
                  </div>
                  {selectedSkill === skill.id && (
                    <Check size={14} color="#57CC86" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* 底部：跳转技能市场 */}
          <div className="px-3 py-2 border-t" style={{ borderColor: '#f0f0f0', background: '#fafafa' }}>
            <button
              onClick={() => { setIsOpen(false); onOpenSkillsPage() }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium hover:bg-gray-100 transition-colors"
              style={{ color: '#666' }}
            >
              <Sparkles size={13} />
              查看全部167个技能
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
