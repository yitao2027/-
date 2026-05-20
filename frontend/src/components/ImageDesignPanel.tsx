/**
 * ═══════════════════════════════════════════════════════════════════════
 * 勺子Claw 图片设计专家 — ImageDesignPanel
 *
 * 来源文档：勺子Claw图片设计功能skill需求（2026043001）
 * 设计者：宋宣 | 实现日期：2026-05-01
 *
 * 7步向导流程：
 *   Step1 品牌档案 → Step2 目的+场景 → Step3 原图上传+AI修图
 *   → Step4 文案收集 → Step5 批量生成 → Step6 展示调整 → Step7 下载存档
 *
 * 默认模型：AI图片生成（API: api.apiyi.com）
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import {
  ChevronRight, ChevronLeft,
  Upload, Sparkles, Download, RefreshCw,
  Check, X, AlertCircle, ImageIcon,
  Building2, Target, FileText, Wand2, Grid3X3,
  Eye, Palette, Camera,
  CheckSquare,
} from 'lucide-react'

// ─── 类型定义 ───

interface BrandProfile {
  brandName: string          // 品牌名称（必填）
  category: string            // 经营品类（必填）
  slogan: string              // Slogan（必填）
  businessType: string        // 经营类型
  priceRange: string          // 客单价段
  primaryColor: string        // 主色
  secondaryColor: string      // 辅色
  stylePreference: string     // 风格偏好
  customStyleDesc: string     // 自定义风格描述
  logoData: string | null     // Logo base64（SVG格式）
}

const BRAND_STORAGE_KEY = 'shaoziclaw_brand_profile'

// 图片位置规格（基于《本地生活三大平台图片规格解析2026042901》）
interface ImagePosition {
  key: string           // 如 'header_large'
  label: string         // 如 '门店头图(大图)'
  size: string          // 输出尺寸 如 '1440x810'
  ratio: string         // 比例 如 '16:9'
  minSize: string       // 最低尺寸 如 '≥500×281'
  requirement: string   // 要求描述
}

// 平台配置（含多位置）
interface PlatformConfig {
  key: PlatformKey
  label: string         // 如 '美团点评'
  category: string      // 如 '本地生活'
  positions: ImagePosition[]
}

type PlatformKey =
  | 'miniapp'       // 点餐小程序展示
  | 'store_indoor'  // 门店内展示
  | 'store_mall'    // 商圈内展示
  | 'meituan_wm'    // 美团外卖
  | 'taobao_sg'     // 淘宝闪购
  | 'jd_wm'         // 京东外卖
  | 'meituan_dp'    // 美团点评
  | 'douyin_lk'     // 抖音来客
  | 'gaode_map'     // 高德地图

interface DishInfo {
  name: string                // 菜品名称
  sellingPoints: string       // 核心卖点
  promoText: string           // 主打宣传文案
  price?: string              // 价格信息
}

interface GeneratedImage {
  id: string                  // 唯一ID
  platform: PlatformKey       // 所属平台
  platformLabel: string       // 平台显示名
  b64Data: string             // base64图片数据
  prompt: string              // 生成的prompt
  size: string                // 尺寸规格
  status: 'generating' | 'done' | 'error'
  error?: string
  variant?: '简约' | '活力'   // 改动4：风格变体
  withText?: boolean          // 改动6：是否带文字（false=纯图）
}

// 改动4：2个风格变体
const STYLE_VARIANTS: { key: '简约' | '活力'; desc: string }[] = [
  { key: '简约', desc: '克制构图、留白充足、字体简洁、突出菜品本身' },
  { key: '活力', desc: '撞色对比、动感构图、视觉冲击强、烟火气浓' },
]

// ─── 常量数据 ───

const BUSINESS_TYPES = [
  '快餐', '轻餐', '正餐', '火锅', '烧烤', '西餐', '日料', '异国料理',
]

const PRICE_RANGES = [
  '20-40元', '40-70元', '70-100元', '100-200元', '200-500元', '500元以上',
]

const STYLE_PRESETS = [
  { key: 'appetizing', label: '🔥 食欲烟火风', desc: '热气腾腾、烟火气息、暖色调' },
  { key: 'guochao', label: '🏮 国潮江湖风', desc: '中式元素、红金配色、大气磅礴' },
  { key: 'minimalist', label: '✨ 简约轻奢风', desc: '干净利落、高级质感、留白美学' },
  { key: 'fresh', label: '🌿 清新生鲜风', desc: '明亮清新、自然色调、健康感' },
  { key: 'industrial', label: '🔧 工业复古风', desc: '金属质感、暗调氛围、硬朗线条' },
  { key: 'warm', label: '☀️ 温馨家庭风', desc: '温暖柔和、亲切自然、家常味道' },
]

const DESIGN_PURPOSES = [
  '重要产品上新',
  '日常迭代修改',
  '品牌形象升级',
  '活动促销推广',
]

const PLATFORMS: PlatformConfig[] = [
  // ── 美团/大众点评 ──
  {
    key: 'meituan_dp', label: '美团点评', category: '本地生活',
    positions: [
      { key: 'header_large', label: '门店头图(大图)', size: '1440x810', ratio: '16:9', minSize: '≥500×281', requirement: '门店实景，禁止AI生成，≤3200×1800' },
      { key: 'header_small', label: '门店头图(小图)', size: '750x563', ratio: '4:3', minSize: '≥500×375', requirement: '门店实景，禁止AI生成' },
      { key: 'entry_img', label: '入口图', size: '800x800', ratio: '1:1', minSize: '≥400×400', requirement: '商户通专属，搜索列表首图' },
      { key: 'dish_photo', label: '菜品图片', size: '900x675', ratio: '4:3', minSize: '≥600×450', requirement: '清晰完整，色彩鲜明有食欲' },
      { key: 'groupbuy_main', label: '团购主图', size: '1290x726', ratio: '16:9', minSize: '≥1080×608', requirement: '建议3-5张轮播展示' },
      { key: 'groupbuy_detail', label: '团购详情图', size: '1200x1600', ratio: '不限', minSize: '宽度≥900', requirement: '最长40张，长度不限' },
      { key: 'env_photo', label: '环境图', size: '1080x810', ratio: '16:9', minSize: '≥500', requirement: '门头/大堂/包间等，5-10张' },
      { key: 'shop_avatar', label: '店铺头像', size: '600x600', ratio: '1:1', minSize: '≥400×400', requirement: '品牌logo或特色菜品特写' },
    ],
  },
  // ── 抖音来客 ──
  {
    key: 'douyin_lk', label: '抖音来客', category: '本地生活',
    positions: [
      { key: 'door_photo', label: '门头图', size: '854x480', ratio: '16:9左右', minSize: '≥640×360', requirement: '实地拍摄，含门牌号，无过度PS' },
      { key: 'dy_groupbuy_main', label: '团购主图', size: '800x1067', ratio: '3:4竖版推荐', minSize: '≥600×600', requirement: '突出商品主体，推荐竖版' },
      { key: 'shop_header', label: '店铺头图', size: '1125x633', ratio: '16:9', minSize: '1125×633', requirement: '最多11张轮播' },
      { key: 'shop_entry', label: '店铺入口图', size: '1000x750', ratio: '4:3', minSize: '1000×750', requirement: '最多6张' },
      { key: 'dish_env', label: '菜品/环境图', size: '960x720', ratio: '4:3或3:2', minSize: '≥640×360', requirement: '色彩鲜艳/整洁明亮' },
      { key: 'qualif_photo', label: '资质图片', size: '800x800', ratio: '方形', minSize: '≥640×360', requirement: '营业执照/食安证' },
    ],
  },
  // ── 高德地图/阿里本地生活 ──
  {
    key: 'gaode_map', label: '高德地图', category: '本地生活',
    positions: [
      { key: 'gd_door_photo', label: '门头照', size: '1440x810', ratio: '4:3或16:9', minSize: '≥1280×720', requirement: '完整门头+门牌号，禁用滤镜' },
      { key: 'gd_shop_header', label: '店铺头图', size: '1440x810', ratio: '16:9', minSize: '≥1280×720', requirement: '全景/logo/特色场景' },
      { key: 'gd_env_dish', label: '环境/菜品图', size: '1440x810', ratio: '4:3或16:9', minSize: '≥1280×720', requirement: '至少5张高清' },
      { key: 'gd_product_photo', label: '商品/团购图', size: '1440x810', ratio: '16:9或4:3', minSize: '≥1280×720', requirement: '清晰展示细节' },
      { key: 'gd_cert_logo', label: '认证标识', size: '600x600', ratio: '1:1', minSize: '≥400×400', requirement: '品牌logo或标识' },
      { key: 'panorama_3d', label: '3D实景', size: '2048x1024', ratio: '2:1', minSize: '≥2048×1024', requirement: '360°全景(阿里专属)' },
    ],
  },
  // ── 美团外卖 ──
  {
    key: 'meituan_wm', label: '美团外卖', category: '外卖',
    positions: [
      { key: 'wm_dish_main', label: '外卖菜品主图', size: '1024x768', ratio: '4:3', minSize: '≥600×450', requirement: '清晰完整，色彩鲜明' },
    ],
  },
  // ── 淘宝闪购 ──
  {
    key: 'taobao_sg', label: '淘宝闪购', category: '外卖',
    positions: [
      { key: 'tb_dish_main', label: '商品主图', size: '1024x768', ratio: '4:3', minSize: '≥600×450', requirement: '清晰展示商品细节' },
    ],
  },
  // ── 京东外卖 ──
  {
    key: 'jd_wm', label: '京东外卖', category: '外卖',
    positions: [
      { key: 'jd_dish_main', label: '商品主图', size: '1024x768', ratio: '4:3', minSize: '≥600×450', requirement: '清晰展示商品细节' },
    ],
  },
]

const STEPS = [
  { num: 1, title: '品牌档案', icon: Building2, subtitle: '建立门店品牌视觉档案' },
  { num: 2, title: '目的场景', icon: Target, subtitle: '确认设计目的和使用平台' },
  { num: 3, title: '原图上传', icon: Camera, subtitle: '上传实拍图 + AI智能修图' },
  { num: 4, title: '文案填写', icon: FileText, subtitle: '菜品名称、卖点、宣传语' },
  { num: 5, title: '批量生成', icon: Wand2, subtitle: '一键生成全平台专属图片' },
  { num: 6, title: '展示调整', icon: Eye, subtitle: '预览效果 + 单张微调' },
  { num: 7, title: '下载存档', icon: Download, subtitle: '批量打包下载 + 使用指南' },
]

// ─── 组件 ───

export default function ImageDesignPanel() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)

  // ── 持久化 key ──
  const BRAND_PROFILE_KEY = 'shaoziclaw_brand_profile'
  const LOGO_DATA_KEY = 'shaoziclaw_logo_data'

  // 🔧 B052: 品牌档案恢复（优先文件系统，fallback localStorage做迁移）
  const getSavedBrand = (): BrandProfile | null => {
    try {
      // 先尝试localStorage（兼容旧数据+迁移）
      const raw = localStorage.getItem(BRAND_PROFILE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        console.log('[ImageDesign] 从localStorage恢复品牌档案:', parsed.brandName || '(空)')
        // 🔧 迁移到文件系统
        invoke('save_image_design_data', { key: BRAND_PROFILE_KEY, value: raw }).catch(() => {})
        return parsed
      }
    } catch (e) {
      console.warn('[ImageDesign] 恢复品牌档案失败:', e)
    }
    return null
  }
  const savedBrand = getSavedBrand()
  const [brand, setBrand] = useState<BrandProfile>(savedBrand || {
    brandName: '', category: '', slogan: '',
    businessType: '', priceRange: '',
    primaryColor: '#57CC86', secondaryColor: '#34D399',
    stylePreference: 'appetizing', customStyleDesc: '',
  })

  // 🔧 B052: 品牌档案变更时自动保存到Rust端文件系统（替代localStorage）
  useEffect(() => {
    const hasAnyData = brand.brandName.trim() || brand.category.trim() || brand.slogan.trim()
    if (hasAnyData) {
      const jsonStr = JSON.stringify(brand)
      // 优先保存到文件系统
      invoke('save_image_design_data', { key: BRAND_PROFILE_KEY, value: jsonStr })
        .then(() => console.log('[ImageDesign] 品牌档案已保存到文件系统'))
        .catch((e) => {
          console.warn('[ImageDesign] 文件系统保存失败，fallback localStorage:', e)
          try { localStorage.setItem(BRAND_PROFILE_KEY, jsonStr) } catch {}
        })
    }
  }, [brand])

  // ── Logo 上传 — 🔧 B052: 保存到Rust端文件系统（替代localStorage）
  const [logoData, setLogoData] = useState<string | null>(() => {
    try { return localStorage.getItem(LOGO_DATA_KEY) } catch { return null }
  })
  const logoInputRef = useRef<HTMLInputElement>(null)

  // 🔧 B052: 组件初始化时从文件系统恢复数据（如果localStorage没有）
  useEffect(() => {
    ;(async () => {
      try {
        // 恢复Logo
        if (!logoData) {
          const savedLogo = await invoke<string | null>('load_image_design_data', { key: LOGO_DATA_KEY })
          if (savedLogo) {
            setLogoData(savedLogo)
            console.log('[ImageDesign] 从文件系统恢复Logo数据')
          }
        }
        // 恢复品牌档案（优先文件系统）
        if (!brand.brandName) {
          const savedBrand = await invoke<string | null>('load_image_design_data', { key: BRAND_PROFILE_KEY })
          if (savedBrand) {
            const parsed = JSON.parse(savedBrand)
            if (parsed.brandName) {
              setBrand(parsed)
              console.log('[ImageDesign] 从文件系统恢复品牌档案:', parsed.brandName)
            }
          }
        }
      } catch (e) {
        console.warn('[ImageDesign] 文件系统恢复数据失败:', e)
      }
    })()
  }, []) // 仅初始化时执行

  // ── VI/风格跳过标记（修改3） ──
  const [viSkipped, setViSkipped] = useState(false)
  const [styleSkipped, setStyleSkipped] = useState(false)

  // ── Step2: 目的+场景 ──
  const [designPurposes, setDesignPurposes] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<PlatformKey>>(new Set())

  // ── Step2: 精细位置选择（修改5） ──
  const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set())
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<PlatformKey>>(new Set())
  /** 切换某个位置选中状态 */
  const togglePosition = (posKey: string) => {
    setSelectedPositions(prev => {
      const next = new Set(prev)
      if (next.has(posKey)) next.delete(posKey)
      else next.add(posKey)
      return next
    })
  }
  /** 一键全选某平台所有位置 */
  const selectAllPositions = (platKey: PlatformKey) => {
    const platConfig = PLATFORMS.find(p => p.key === platKey)
    if (!platConfig) return
    setSelectedPositions(prev => {
      const next = new Set(prev)
      platConfig.positions.forEach(pos => next.add(`${platKey}:${pos.key}`))
      return next
    })
    setSelectedPlatforms(prev => new Set(prev).add(platKey))
  }
  /** 切换平台展开/折叠 */
  const toggleExpandPlatform = (platKey: PlatformKey) => {
    setExpandedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(platKey)) next.delete(platKey)
      else next.add(platKey)
      return next
    })
  }

  // ── Step3: 原图上传（支持多图） ──
  const [originalImage, setOriginalImage] = useState<string | null>(null)  // 当前处理的base64原图
  const [originalImages, setOriginalImages] = useState<{ name: string; b64: string }[]>([])  // 多图列表
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null)  // AI修图后
  const [imageFileName, setImageFileName] = useState<string>('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhanceElapsed, setEnhanceElapsed] = useState(0)   // 修图已耗时(秒)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)   // 修图错误信息
  const [stepSkipped, setStepSkipped] = useState(false)    // 是否跳过了此步
  const [showComboChoice, setShowComboChoice] = useState(false)  // 多图套餐选择弹窗
  const [comboMode, setComboMode] = useState<'combo' | 'individual' | null>(null)  // 套餐/独立
  const [currentImageIndex, setCurrentImageIndex] = useState(0)  // 当前处理第几张图
  const enhanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef(false)  // 中断标记

  // ── 每日生成上限（15张/天） ──
  const DAILY_LIMIT = 15
  const DAILY_COUNT_KEY = 'shaoziclaw_daily_gen_count'
  const getDailyCount = (): number => {
    try {
      const stored = localStorage.getItem(DAILY_COUNT_KEY)
      if (!stored) return 0
      const { date, count } = JSON.parse(stored)
      if (date !== new Date().toISOString().slice(0, 10)) return 0
      return count
    } catch { return 0 }
  }
  const incrementDailyCount = (n: number) => {
    const today = new Date().toISOString().slice(0, 10)
    const current = getDailyCount()
    localStorage.setItem(DAILY_COUNT_KEY, JSON.stringify({ date: today, count: current + n }))
  }

  // ── Step4: 文案 ──
  const [dishInfo, setDishInfo] = useState<DishInfo>({
    name: '', sellingPoints: '', promoText: '', price: '',
  })
  // 改动6：是否同时输出"不带文字"版（纯图，便于后期自由排版）
  const [generateNoText, setGenerateNoText] = useState(false)
  // 改动4：是否同时输出 2 个风格变体（简约 + 活力）
  const [generateBothVariants, setGenerateBothVariants] = useState(false)

  // ── Step5/6: 生成结果 ──
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── 平台勾选切换 ───
  const togglePlatform = (key: PlatformKey) => {
    setSelectedPlatforms(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePurpose = (p: string) => {
    setDesignPurposes(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
  }

  // ─── 图片上传处理（支持多图） ───
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    // 重置状态
    setEnhancedImage(null)
    setComboMode(null)
    setCurrentImageIndex(0)

    if (files.length === 1) {
      // 单图：保持原有逻辑
      const file = files[0]
      setImageFileName(file.name)
      const reader = new FileReader()
      reader.onload = () => {
        const b64 = reader.result as string
        setOriginalImage(b64)
        setOriginalImages([{ name: file.name, b64 }])
      }
      reader.readAsDataURL(file)
    } else {
      // 多图：读取所有图片，弹出套餐/独立选择
      const imgList: { name: string; b64: string }[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const b64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
        imgList.push({ name: file.name, b64 })
      }
      setOriginalImages(imgList)
      setOriginalImage(imgList[0].b64)
      setImageFileName(`${imgList.length}张图片`)
      setShowComboChoice(true) // 弹出选择弹窗
    }
  }

  // ─── Logo上传处理（修改2：仅支持SVG） ──
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // 校验格式
    if (!file.name.toLowerCase().endsWith('.svg')) {
      alert('Logo 仅支持 SVG 矢量格式，请选择 .svg 文件')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      setLogoData(b64)
      // 🔧 B052: 保存到文件系统（替代localStorage，解决配额问题）
      invoke('save_image_design_data', { key: LOGO_DATA_KEY, value: b64 })
        .catch((e) => {
          console.warn('[ImageDesign] Logo文件系统保存失败，fallback localStorage:', e)
          try { localStorage.setItem(LOGO_DATA_KEY, b64) } catch {}
        })
    }
    reader.readAsDataURL(file)
  }

  // ─── 调用后端AI生图 ───
  // 🔧 v5.5.22 hotfix: 增加 referenceImageB64 参数，支持图生图（AI修图传原图）
  const callGenerateAPI = async (
    prompt: string,
    size: string = '1024x1024',
    referenceImageB64?: string
  ): Promise<{ success: boolean; b64Data?: string; error?: string }> => {
    try {
      let result: any
      if (referenceImageB64) {
        // 图生图模式：调用 image_generate_with_ref，传入原图
        result = await invoke<any>('image_generate_with_ref', {
          prompt,
          referenceImageUrl: referenceImageB64
        })
      } else {
        // 纯文生图模式
        result = await invoke<any>('image_generate', { prompt, size: size || undefined })
      }
      if (result.success && result.b64_data) {
        return { success: true, b64Data: result.b64_data }
      }
      return { success: false, error: result.error || '未返回图片数据' }
    } catch (e: any) {
      return { success: false, error: e.toString() }
    }
  }

  // ─── Step3: AI智能修图（优化原图画质） ───
  const handleEnhance = async () => {
    if (!originalImage) return

    // 重置所有状态
    abortRef.current = false
    setEnhanceError(null)
    setEnhancedImage(null)
    setStepSkipped(false)
    setIsEnhancing(true)
    setEnhanceElapsed(0)

    // 启动计时器（每秒更新）
    enhanceTimerRef.current = setInterval(() => {
      setEnhanceElapsed(prev => prev + 1)
    }, 1000)

    const enhancePrompt =
`【任务类型】图像画质增强（image enhancement / restoration），不是图像生成（image generation），不是图像编辑（image editing）。

【唯一允许的操作】
仅对输入图片做以下后期处理：
1. 自动白平衡与曝光修正（提亮欠曝、压暗高光）
2. 提升锐度与细节（菜品边缘、纹理）
3. 适度提升色彩饱和度与对比度（更有食欲感）
4. 降噪、去模糊
5. 输出高质量 PNG

【⛔ 绝对禁止 — 违反任意一条均为严重错误】
1. 禁止改变画面中的任何主体、菜品、餐具、桌面、背景、构图、视角、光源方向。
2. 禁止替换、移除、新增任何物体（包括但不限于背景、灯光、餐具、装饰、文字）。
3. 禁止在图片上添加任何文字、logo、水印、标签、品牌名、菜名、价格、签名、印章。
4. 禁止改变图片的纵横比、裁切方式。
5. 禁止把照片改成插画、油画、3D 渲染或任何其他风格——必须保持原始摄影风格。
6. 输入是什么菜，输出必须还是同一道菜的同一张照片，只是画质更好。例：输入炒青菜→输出炒青菜；输入回锅肉→输出回锅肉。

【自检】
输出前请确认：(a) 主体内容与输入完全一致；(b) 画面上没有任何文字；(c) 仅做了画质优化。任一不满足则放弃生成。`

    try {
      console.log('[ImageDesign] 开始AI修图，prompt长度:', enhancePrompt.length)

      // 🔧 用Promise.race实现超时控制（最多等180秒，与后端HTTP超时一致）
      // 🔧 v5.5.22 hotfix: 必须传 originalImage 走图生图模式，避免墨行退化为纯文生图
      const TIMEOUT_MS = 180_000
      const invokePromise = callGenerateAPI(enhancePrompt, '1024x1024', originalImage)
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => resolve({ success: false, error: 'AI修图超时（>180秒）。墨行API响应较慢，建议稍后重试或检查网络。' }), TIMEOUT_MS)
      })

      const result = await Promise.race([invokePromise, timeoutPromise])

      // 检查是否被中断
      if (abortRef.current) return

      if (result.success && result.b64Data) {
        console.log('[ImageDesign] AI修图成功，b64长度:', result.b64Data.length)
        setEnhancedImage(result.b64Data)
        setEnhanceError(null)
      } else {
        console.warn('[ImageDesign] AI修图失败:', result.error)
        setEnhanceError(result.error || '未返回图片数据')
      }
    } catch (e: any) {
      console.error('[ImageDesign] AI修图异常:', e)
      if (!abortRef.current) {
        setEnhanceError(e?.message || e?.toString() || '未知错误')
      }
    } finally {
      // 无论成功/失败/取消/超时，都清理状态
      setIsEnhancing(false)
      setEnhanceElapsed(0)
      if (enhanceTimerRef.current) {
        clearInterval(enhanceTimerRef.current)
        enhanceTimerRef.current = null
      }
    }
  }

  /** 停止AI修图 */
  const handleCancelEnhance = () => {
    abortRef.current = true
    setIsEnhancing(false)
    setEnhanceError('已停止等待')
    if (enhanceTimerRef.current) {
      clearInterval(enhanceTimerRef.current)
      enhanceTimerRef.current = null
    }
  }

  /** 跳过此步（直接用原图） */
  const handleSkipStep = () => {
    abortRef.current = true
    setIsEnhancing(false)
    setEnhanceError(null)
    setStepSkipped(true)
    if (enhanceTimerRef.current) {
      clearInterval(enhanceTimerRef.current)
      enhanceTimerRef.current = null
    }
  }

  // ─── Step5: 批量生成 ───
  const handleBatchGenerate = async () => {
    if (!enhancedImage && !originalImage) {
      alert('请先上传并修图')
      setCurrentStep(3)
      return
    }
    if (selectedPositions.size === 0) {
      alert('请至少选择一个图片位置')
      setCurrentStep(2)
      return
    }
    if (!dishInfo.name) {
      alert('请填写菜品名称')
      setCurrentStep(4)
      return
    }

    // 改动4 + 改动6：计算总任务数（位置 × 风格变体 × 文字版本）
    const variantList: ('简约' | '活力')[] = generateBothVariants ? ['简约', '活力'] : ['简约']
    const textList: boolean[] = generateNoText ? [true, false] : [true]
    const totalTasks = selectedPositions.size * variantList.length * textList.length

    // 每日上限校验（15 张/天）
    const usedToday = getDailyCount()
    if (usedToday + totalTasks > DAILY_LIMIT) {
      alert(
        `⚠️ 超出每日生成上限\n\n` +
        `今日已生成：${usedToday} 张\n` +
        `本次预计：${totalTasks} 张\n` +
        `每日上限：${DAILY_LIMIT} 张\n\n` +
        `请减少位置/风格/文字版本数量，或明日再试。`
      )
      return
    }

    setIsGenerating(true)
    const results: GeneratedImage[] = []
    // 修复：保存每个任务对应的 platConfig/posConfig 闭包引用，避免后续从 ID 反解析（含下划线的 platKey 会被 split 错误切分）
    const taskMetas: Array<{ platConfig: typeof PLATFORMS[number]; posConfig: typeof PLATFORMS[number]['positions'][number] }> = []

    // 笛卡尔积：位置 × 风格变体 × 带/不带文字
    for (const posFullKey of Array.from(selectedPositions)) {
      const sepIdx = posFullKey.indexOf(':')
      if (sepIdx < 0) continue
      const platKey = posFullKey.slice(0, sepIdx)
      const posKey = posFullKey.slice(sepIdx + 1)
      const platConfig = PLATFORMS.find(p => p.key === platKey)
      if (!platConfig) continue
      const posConfig = platConfig.positions.find(p => p.key === posKey)
      if (!posConfig) continue

      for (const variant of variantList) {
        for (const withText of textList) {
          const tag = `${variant}${withText ? '·有字' : '·无字'}`
          const imgId = `img_${Date.now()}_${posFullKey}_${variant}_${withText ? 't' : 'n'}_${Math.random().toString(36).slice(2, 6)}`
          results.push({
            id: imgId,
            platform: platKey as PlatformKey,
            platformLabel: `${platConfig.label} - ${posConfig.label} (${tag})`,
            b64Data: '',
            prompt: '',
            size: posConfig.size,
            status: 'generating',
            variant,
            withText,
          })
          taskMetas.push({ platConfig, posConfig })
        }
      }
    }
    setGeneratedImages(results)

    // 逐个任务生成
    for (let i = 0; i < results.length; i++) {
      const item = results[i]
      const meta = taskMetas[i]

      if (!meta || !meta.platConfig || !meta.posConfig) {
        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, status: 'error' as const, error: '位置配置不存在' } : img
        ))
        continue
      }
      const { platConfig, posConfig } = meta

      // 🔧 B096修复: 使用风格描述而非标签,避免暴露"江湖风"等元数据
      const stylePreset = STYLE_PRESETS.find(s => s.key === brand.stylePreference)
      const styleDesc = stylePreset?.desc || '现代简约、干净利落'
      const variantConfig = STYLE_VARIANTS.find(v => v.key === item.variant)
      const variantDesc = variantConfig?.desc || ''

      // 🔧 B096修复: 色彩描述转换为自然语言,完全避免暴露十六进制色卡代码
      const getColorDesc = (hex: string): string => {
        const upper = hex.toUpperCase()
        if (upper.includes('E1') || upper.includes('F4') || upper.includes('EF4')) return '暖色系红橙调'
        if (upper.includes('57') || upper.includes('34') || upper.includes('10B981')) return '清新绿色调'
        if (upper.includes('3B') || upper.includes('60') || upper.includes('3B82F6')) return '沉稳蓝色调'
        if (upper.includes('F59') || upper.includes('FBBF')) return '活力橙黄调'
        if (upper.includes('A855') || upper.includes('8B5')) return '优雅紫色调'
        return '温暖自然色调'
      }
      const colorDesc = getColorDesc(brand.primaryColor)

      let prompt = `为餐饮品牌「${brand.brandName || '美味餐厅'}」设计一张专业的${platConfig.category}平台配图：

【菜品信息】
菜名：${dishInfo.name}
卖点：${dishInfo.sellingPoints}
${dishInfo.promoText && item.withText ? `文案：${dishInfo.promoText}` : ''}
${dishInfo.price && item.withText ? `价格：${dishInfo.price}` : ''}

【设计规格】
平台：${platConfig.label}
位置用途：${posConfig.label}
画面方向：${posConfig.ratio.startsWith('16') || posConfig.ratio.includes('横') ? '横版构图' : posConfig.ratio === '1:1' ? '方形构图' : '竖版构图'}
视觉风格：${styleDesc}${brand.customStyleDesc ? '，' + brand.customStyleDesc : ''}
色调方向：${colorDesc}
${brand.slogan && item.withText ? `品牌口号：${brand.slogan}` : ''}

【风格调性】
${variantDesc}

【文字版本】
${item.withText
  ? `- 在画面合适位置加入菜名、文案、价格等核心文字信息（中文为主，避免错别字）
- 文字排版要符合整体视觉调性
- 文字与背景对比清晰可读`
  : `- ⚠️ 严禁在画面任何位置出现任何文字、字符、口号、价格、品牌名（LOGO 除外）
- 这是一张纯图版，画面只能有菜品和场景元素
- 让构图、光影、留白本身讲故事，便于后期自由排版`}

【位置特殊要求】
${posConfig.requirement}

【出图要求】
- 商业级高清画质，可直接用于平台上传
- 菜品主体清晰突出，视觉焦点明确
- 符合${platConfig.label}平台的图片规范和安全区要求
- 整体风格统一，有品牌辨识度和食欲感
${designPurposes.includes('重要产品上新') ? '- 突出新品感，吸引眼球\n' : ''}${designPurposes.includes('活动促销推广') ? '- 包含促销信息视觉引导\n' : ''}${logoData ? `
【品牌LOGO】
- 必须将品牌LOGO设计在图片上（位置：右下角或左上角，不遮挡菜品主体）
- LOGO保持原始比例和颜色，清晰可辨，大小适中（约占画面5%-8%面积）
- 如果LOGO与背景对比度不足，添加半透明底衬确保可读性
` : ''}
【⛔ 绝对禁止】
- 禁止在图片上添加任何字段标签（如"菜名："、"价格："、"卖点："、"文案："等）
- 禁止在图片上显示颜色代码（如#E11D48、#F43F5E等十六进制色值）
- 禁止在图片上显示风格名称标签（如"江湖风"、"简约版"、"活力版"等）
- 禁止在图片上显示尺寸信息（如"1024x1024"、"16:9"等）
- 只渲染用户填写的实际内容（菜名、价格数字、卖点文案），不要渲染任何UI模板的元数据`

      try {
        const apiSize = posConfig.ratio.startsWith('16')
          ? '1792x1024'
          : posConfig.ratio === '3:4' || posConfig.ratio.includes('竖版')
            ? '1024x1536'
            : posConfig.ratio === '1:1'
              ? '1024x1024'
              : posConfig.ratio === '2:1'
                ? '2048x1024'
                : '1024x1024'

      // 🔧 B095 v5.5.24: 批量生成走图生图模式
      // - 用户做了AI修图 → 用 enhancedImage 作参考图
      // - 用户跳过AI修图 → 用 originalImage 作参考图
      const refImage = enhancedImage || originalImage || undefined

      // 图生图模式：替换 prompt 开头，加入参考图引导语
      if (refImage) {
        prompt = prompt.replace(
          `为餐饮品牌「${brand.brandName || '美味餐厅'}」设计一张专业的${platConfig.category}平台配图：`,
          `基于参考图中的菜品，为餐饮品牌「${brand.brandName || '美味餐厅'}」设计一张专业的${platConfig.category}平台配图。\n参考图中的菜品是设计的核心主体，必须保留其真实外观、色泽和质感，在此基础上进行商业级视觉包装：`
        )
      }

        const result = await callGenerateAPI(prompt, apiSize, refImage)

        // 改动4+6：成功一张就计 1 次额度
        if (result.success) incrementDailyCount(1)

        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id
            ? {
                ...img,
                status: result.success ? 'done' as const : 'error' as const,
                b64Data: result.success ? (result.b64Data || '') : '',
                prompt,
                error: result.error,
              }
            : img
        ))
      } catch {
        setGeneratedImages(prev => prev.map(img =>
          img.id === item.id ? { ...img, status: 'error' as const, error: '请求异常' } : img
        ))
      }
    }

    setIsGenerating(false)
  }

  // ─── 单张重绘 ───
  const handleRegenerate = async (imgId: string) => {
    const target = generatedImages.find(i => i.id === imgId)
    if (!target) return

    setGeneratedImages(prev => prev.map(i =>
      i.id === imgId ? { ...i, status: 'generating' as const, error: undefined } : i
    ))

    // 🔧 B095 v5.5.24: 重绘也走图生图，与批量生成保持一致
    const refImage = enhancedImage || originalImage || undefined
    const result = await callGenerateAPI(target.prompt, target.size.replace('x', 'x'), refImage)
    setGeneratedImages(prev => prev.map(i =>
      i.id === imgId
        ? {
            ...i,
            status: result.success ? ('done' as const) : ('error' as const),
            b64Data: result.success ? (result.b64Data || '') : '',
            error: result.error,
          }
        : i
    ))
  }

  // ─── base64 → Uint8Array ───
  const b64ToUint8Array = (b64: string): Uint8Array => {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }

  // ─── 单张下载（Tauri dialog + fs） ───
  const downloadSingle = async (img: GeneratedImage) => {
    try {
      const fileName = `${img.platformLabel}_${dishInfo.name || '菜品'}_${img.size}.png`
      const filePath = await save({
        title: '保存图片',
        defaultPath: fileName,
        filters: [{ name: 'PNG Files', extensions: ['png'] }],
      })
      if (!filePath) return // 用户取消

      // base64 → Uint8Array → base64 for IPC
      const bytes = b64ToUint8Array(img.b64Data)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const dataBase64 = btoa(binary)

      await invoke('save_file_to_disk', { path: filePath, dataBase64 })
      console.log(`[ImageDesign] 图片已保存: ${filePath}`)
    } catch (err) {
      console.error('[ImageDesign] 下载失败:', err)
    }
  }

  // ─── 批量下载全部 ───
  const downloadAll = async () => {
    const doneImgs = generatedImages.filter(i => i.status === 'done')
    for (const img of doneImgs) {
      await downloadSingle(img)
    }
  }

  // ─── 步骤导航校验 ───
  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 1: return !!(brand.brandName.trim() && brand.category.trim())
      case 2: return selectedPositions.size > 0
      case 3: return !!originalImage && (!!enhancedImage || stepSkipped)
      case 4: return !!dishInfo.name.trim()
      default: return true
    }
  }

  const goNext = () => {
    if (currentStep < 7 && canGoNext()) setCurrentStep(currentStep + 1)
  }
  const goBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  // ─── 渲染：步骤指示条 ───
  const renderStepIndicator = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 0, padding: '20px 32px 16px', background: '#fff',
      borderBottom: '1px solid #F3F4F6',
    }}>
      {STEPS.map((step, idx) => (
        <div key={step.num} style={{ display: 'flex', alignItems: 'center' }}>
          <div onClick={() => currentStep > step.num && setCurrentStep(step.num)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              cursor: currentStep >= step.num ? 'pointer' : 'default',
              opacity: currentStep >= step.num ? 1 : 0.35,
              transition: 'opacity 0.25s',
            }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: currentStep === step.num ? '#57CC86'
                : currentStep > step.num ? '#57CC86' : '#E5E7EB',
              color: '#fff', fontSize: '12px', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.25s',
            }}>
              {currentStep > step.num ? <Check size={14} /> : step.num}
            </div>
            <span style={{
              fontSize: '12.5px', fontWeight: currentStep === step.num ? 700 : 400,
              color: currentStep === step.num ? '#57CC86' : '#6B7280',
              whiteSpace: 'nowrap',
            }}>{step.title}</span>
          </div>
          {idx < STEPS.length - 1 && <ChevronRight size={14} style={{ color: '#D1D5DB', margin: '0 6px' }} />}
        </div>
      ))}
    </div>
  )

  // ════════════════════════════════════════
  // STEP 1: 品牌档案
  // ════════════════════════════════════════
  const renderStep1 = () => (
    <div style={{ padding: '28px 36px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        🏢 建立品牌视觉档案
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 24px' }}>
        首次填写，永久复用。后续所有生图将自动应用您的品牌VI。
      </p>

      {/* 基本信息 */}
      <div style={{
        background: '#FAFAFA', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px',
        border: '1px solid #F3F4F6',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>
          📋 基本信息<span style={{ color: '#57CC86' }}>*</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '4px' }}>
              品牌名称<span style={{ color: '#57CC86' }}>*</span>
            </label>
            <input value={brand.brandName}
              onChange={(e) => setBrand({ ...brand, brandName: e.target.value })}
              placeholder="例如：蜀大侠火锅"
              style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '4px' }}>
              经营品类<span style={{ color: '#57CC86' }}>*</span>
            </label>
            <input value={brand.category}
              onChange={(e) => setBrand({ ...brand, category: e.target.value })}
              placeholder="例如：川味火锅 / 湘菜 / 烧烤"
              style={inputStyle} />
          </div>
          <div className="full-width" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '4px' }}>
              Slogan / 品牌口号<span style={{ color: '#57CC86' }}>*</span>
            </label>
            <input value={brand.slogan}
              onChange={(e) => setBrand({ ...brand, slogan: e.target.value })}
              placeholder="例如：一锅煮尽江湖味"
              style={inputStyle} />
          </div>
        </div>

        {/* 经营类型 */}
        <div style={{ marginTop: '16px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '8px' }}>经营类型</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {BUSINESS_TYPES.map(t => (
              <button key={t} onClick={() => setBrand({ ...brand, businessType: t })}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '12.5px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                  ...(brand.businessType === t
                    ? { borderColor: '#57CC86', background: '#E6F7EF', color: '#57CC86', fontWeight: 600 }
                    : { borderColor: '#E5E7EB', background: '#fff', color: '#6B7280' }),
                }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 客单价 */}
        <div style={{ marginTop: '14px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '8px' }}>客单价位</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {PRICE_RANGES.map(p => (
              <button key={p} onClick={() => setBrand({ ...brand, priceRange: p })}
                style={{
                  padding: '6px 14px', borderRadius: '20px', fontSize: '12.5px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                  ...(brand.priceRange === p
                    ? { borderColor: '#57CC86', background: '#E6F7EF', color: '#57CC86', fontWeight: 600 }
                    : { borderColor: '#E5E7EB', background: '#fff', color: '#6B7280' }),
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VI资料（可跳过） */}
      <div style={{
        background: '#FAFAFA', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px',
        border: '1px dashed #D1D5DB',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>
            🎨 VI视觉资料（可跳过）
          </h3>
          {!viSkipped ? (
            <button onClick={() => setViSkipped(true)}
              style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D1D5DB',
                background: '#fff', color: '#9CA3AF', fontSize: '11.5px', cursor: 'pointer' }}>
              跳过 →
            </button>
          ) : (
            <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 500 }}>✓ 已跳过</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '4px' }}>品牌主色</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={brand.primaryColor}
                onChange={(e) => setBrand({ ...brand, primaryColor: e.target.value })}
                style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: 2 }} />
              <input value={brand.primaryColor} readOnly
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '4px' }}>辅助色</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={brand.secondaryColor}
                onChange={(e) => setBrand({ ...brand, secondaryColor: e.target.value })}
                style={{ width: '36px', height: '36px', border: 'none', borderRadius: '8px', cursor: 'pointer', padding: 2 }} />
              <input value={brand.secondaryColor} readOnly
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }} />
            </div>
          </div>
        </div>

        {/* 🆕 Logo上传（修改2） */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #E5E7EB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {logoData ? (
              <div style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden',
                border: '1px solid #D1D5DB', background: '#fff', position: 'relative' }}>
                <img src={`data:image/svg+xml;base64,${logoData}`} alt="Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                <button onClick={() => { setLogoData(null); try { localStorage.removeItem(LOGO_DATA_KEY) } catch {} }}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', width: '18px', height: '18px',
                    borderRadius: '50%', background: '#D1FAE5', border: 'none', color: '#059669',
                    fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>×</button>
              </div>
            ) : (
              <button onClick={() => logoInputRef.current?.click()}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: '1px dashed #9CA3AF',
                  background: '#fff', color: '#6B7280', fontSize: '12px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                <Upload size={14} /> 📐 上传 Logo（SVG格式）
              </button>
            )}
            <span style={{ fontSize: '10.5px', color: '#9CAAF', marginLeft: '8px' }}>
              仅支持 SVG 矢量格式，确保缩放清晰
            </span>
          </div>
          <input ref={logoInputRef} type="file" accept=".svg"
            onChange={handleLogoUpload} style={{ display: 'none' }} />
        </div>
      </div>

      {/* 风格偏好 */}
      <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '20px 24px', border: '1px dashed #D1D5DB' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#374151', margin: 0 }}>
            ✨ 设计风格偏好（可跳过）
          </h3>
          {!styleSkipped ? (
            <button onClick={() => setStyleSkipped(true)}
              style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid #D1D5DB',
                background: '#fff', color: '#9CA3AF', fontSize: '11.5px', cursor: 'pointer' }}>
              跳过 →
            </button>
          ) : (
            <span style={{ fontSize: '11.5px', color: '#059669', fontWeight: 500 }}>✓ 已跳过</span>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {STYLE_PRESETS.map(s => (
            <button key={s.key} onClick={() => setBrand({ ...brand, stylePreference: s.key })}
              style={{
                padding: '10px 14px', borderRadius: '10px', fontSize: '13px', textAlign: 'left',
                border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                ...(brand.stylePreference === s.key
                  ? { borderColor: '#57CC86', background: '#E6F7EF', color: '#047857' }
                  : { borderColor: '#E5E7EB', background: '#fff', color: '#374151' }),
              }}>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
              <div style={{ fontSize: '11px', marginTop: '2px', opacity: 0.7 }}>{s.desc}</div>
            </button>
          ))}
        </div>
        {(brand.stylePreference === 'custom' || brand.customStyleDesc) && (
          <textarea value={brand.customStyleDesc}
            onChange={(e) => setBrand({ ...brand, customStyleDesc: e.target.value })}
            placeholder="自定义风格描述，例如：暗调工业风 + 霓虹光效..."
            rows={2} style={{ ...inputStyle, width: '100%', marginTop: '10px', resize: 'vertical' }} />
        )}
      </div>
    </div>
  )

  // ════════════════════════════════════════
  // STEP 2: 目的 + 场景选择（修改5：嵌套结构+精细位置选择）
  // ════════════════════════════════════════
  const renderStep2 = () => {
    // 按category分组
    const categories = ['本地生活', '外卖', '堂食']
    const catCount: Record<string, number> = {}
    categories.forEach(cat => {
      catCount[cat] = 0
    })
    PLATFORMS.forEach(p => {
      if (catCount[p.category] !== undefined) catCount[p.category]++
    })

    return (
      <div style={{ padding: '28px 36px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          🎯 确认设计目的 & 使用场景
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 24px' }}>
          选择本次设计的用途和需要生成的平台图片规格（可精确到每个位置）
        </p>

        {/* 设计目的 */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>
            本次设计目的
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {DESIGN_PURPOSES.map(p => (
              <button key={p} onClick={() => togglePurpose(p)}
                style={{
                  padding: '8px 18px', borderRadius: '22px', fontSize: '13px',
                  border: '1px solid', cursor: 'pointer', transition: 'all 0.2s',
                  ...(designPurposes.includes(p)
                    ? { borderColor: '#57CC86', background: '#57CC86', color: '#fff', fontWeight: 600 }
                    : { borderColor: '#E5E7EB', background: '#fff', color: '#4B5563' }),
                }}>
                {designPurposes.includes(p) && <Check size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />}
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 平台分类：按 category 分组展示 */}
        {categories.map(cat => {
          const catPlats = PLATFORMS.filter(p => p.category === cat)
          if (catPlats.length === 0) return null

          return (
            <div key={cat} style={{ marginBottom: '22px' }}>
              {/* 分类标题 */}
              <h3 style={{
                fontSize: '15px', fontWeight: 600, color: '#1F2937',
                margin: '0 0 12px', paddingBottom: '8px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {cat === '本地生活' && '📍'}
                {cat === '外卖' && '🛵'}
                {cat === '堂食' && '🏪'}
                {cat}平台
                <span style={{
                  fontSize: '12px', fontWeight: 400, color: '#9CA3AF',
                  background: '#F3F4F6', padding: '2px 10px', borderRadius: '10px',
                }}>
                  已选 {selectedPositions.size} 个位置
                </span>
              </h3>

              {/* 该分类下的各平台 */}
              {catPlats.map(plat => {
                const isExpanded = expandedPlatforms.has(plat.key)
                const platSelectedCount = plat.positions.filter(
                  p => selectedPositions.has(`${plat.key}:${p.key}`)
                ).length
                const isAllSelected = platSelectedCount === plat.positions.length

                return (
                  <div key={plat.key} style={{
                    marginBottom: '10px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    background: '#fff',
                    transition: 'border-color 0.2s',
                  }}>
                    {/* 平台标题栏：点击展开/折叠 */}
                    <div
                      onClick={() => toggleExpandPlatform(plat.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        background: isExpanded ? '#FAFAFA' : '#fff',
                        borderBottom: isExpanded ? '1px solid #E5E7EB' : 'none',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isExpanded) e.currentTarget.style.background = '#F9FAFB'
                      }}
                      onMouseLeave={(e) => {
                        if (!isExpanded) e.currentTarget.style.background = '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* 展开/折叠箭头 */}
                        <ChevronRight size={16} style={{
                          color: '#9CA3AF',
                          transition: 'transform 0.2s',
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                        }} />
                        {/* 平台名称 + 选中计数 */}
                        <span style={{
                          fontSize: '14px', fontWeight: 600,
                          color: isAllSelected ? '#57CC86' : '#374151',
                        }}>
                          {plat.label}
                        </span>
                        {platSelectedCount > 0 && (
                          <span style={{
                            fontSize: '11px', color: '#57CC86',
                            background: '#E6F7EF', padding: '1px 8px', borderRadius: '8px',
                            fontWeight: 500,
                          }}>
                            ✓ {platSelectedCount}/{plat.positions.length}
                          </span>
                        )}
                      </div>
                      {/* 全选按钮 */}
                      <button
                        onClick={(e) => { e.stopPropagation(); selectAllPositions(plat.key) }}
                        style={{
                          fontSize: '12px', padding: '4px 12px', borderRadius: '14px',
                          border: isAllSelected ? '1px solid #57CC86' : '1px solid #D1D5DB',
                          background: isAllSelected ? '#57CC86' : '#fff',
                          color: isAllSelected ? '#fff' : '#6B7280',
                          cursor: 'pointer', fontWeight: 500,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          if (!isAllSelected) {
                            e.currentTarget.style.borderColor = '#57CC86'
                            e.currentTarget.style.color = '#57CC86'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isAllSelected) {
                            e.currentTarget.style.borderColor = '#D1D5DB'
                            e.currentTarget.style.color = '#6B7280'
                          }
                        }}
                      >
                        {isAllSelected ? '✓ 全选已选' : '✓ 全选'}
                      </button>
                    </div>

                    {/* 展开内容：位置列表 */}
                    {isExpanded && (
                      <div style={{ padding: '8px 12px 12px', background: '#FAFBFC' }}>
                        {plat.positions.map(pos => {
                          const posFullKey = `${plat.key}:${pos.key}`
                          const isSelected = selectedPositions.has(posFullKey)

                          return (
                            <label key={pos.key} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                              padding: '8px 10px', borderRadius: '8px',
                              cursor: 'pointer',
                              background: isSelected ? '#E6F7EF' : 'transparent',
                              transition: 'background 0.15s',
                              marginBottom: '2px',
                            }}
                              onMouseEnter={(e) => {
                                if (!isSelected) e.currentTarget.style.background = '#F3F4F6'
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) e.currentTarget.style.background = 'transparent'
                              }}
                            >
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePosition(posFullKey)}
                                style={{
                                  marginTop: '2px',
                                  width: '16px', height: '16px',
                                  accentColor: '#57CC86',
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              />
                              {/* 位置信息 */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'baseline', gap: '8px',
                                  flexWrap: 'wrap',
                                }}>
                                  <span style={{
                                    fontSize: '13px', fontWeight: 500,
                                    color: isSelected ? '#57CC86' : '#374151',
                                  }}>
                                    {pos.label}
                                  </span>
                                  <span style={{
                                    fontSize: '11px', color: '#57CC86',
                                    background: '#ECFDF5', padding: '0 6px',
                                    borderRadius: '4px', whiteSpace: 'nowrap',
                                  }}>
                                    {pos.size} px
                                  </span>
                                  <span style={{
                                    fontSize: '11px', color: '#9CA3AF',
                                    whiteSpace: 'nowrap',
                                  }}>
                                    ({pos.ratio})
                                  </span>
                                </div>
                                <div style={{
                                  fontSize: '11.5px', color: '#6B7280',
                                  marginTop: '2px', lineHeight: '1.4',
                                }}>
                                  <span style={{ color: '#9CA3AF' }}>最低:</span> {pos.minSize}
                                  {' · '}
                                  <span style={{ color: '#9CA3AF' }}>要求:</span> {pos.requirement}
                                </div>
                              </div>
                              {/* 选中标记 */}
                              {isSelected && (
                                <Check size={16} style={{ color: '#57CC86', flexShrink: 0, marginTop: '2px' }} />
                              )}
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* 未选择提示 */}
        {selectedPositions.size === 0 && (
          <div style={{
            padding: '14px 18px', background: '#FEF3C7', borderRadius: '10px',
            fontSize: '13px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '8px',
            marginTop: '8px',
          }}>
            <AlertCircle size={16} /> 请至少展开一个平台并勾选需要生成的图片位置
          </div>
        )}

        {/* 已选统计 */}
        {selectedPositions.size > 0 && (
          <div style={{
            padding: '12px 18px', background: '#F0FDF4', borderRadius: '10px',
            fontSize: '13px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px',
            marginTop: '8px',
          }}>
            <CheckSquare size={16} />
            已选择 <strong>{selectedPositions.size}</strong> 个图片位置，
            将为这些规格分别生成适配图片
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════
  // STEP 3: 上传 + AI修图
  // ════════════════════════════════════════
  const renderStep3 = () => (
    <div style={{ padding: '28px 36px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        📷 上传原始菜品图
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 24px' }}>
        上传菜品实拍图（支持多张），系统将自动进行AI智能优化
      </p>

      {/* 多图套餐选择弹窗 */}
      {showComboChoice && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '32px',
            maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
              已上传 {originalImages.length} 张图片
            </h3>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 20px' }}>
              这些菜品图片是什么关系？
            </p>
            {/* 缩略图预览 */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {originalImages.slice(0, 6).map((img, i) => (
                <div key={i} style={{ width: '52px', height: '52px', borderRadius: '8px',
                  overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                  <img src={img.b64} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
              {originalImages.length > 6 && (
                <div style={{ width: '52px', height: '52px', borderRadius: '8px',
                  background: '#F3F4F6', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '12px', color: '#6B7280' }}>
                  +{originalImages.length - 6}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={() => { setComboMode('combo'); setShowComboChoice(false) }}
                style={{ padding: '14px 20px', borderRadius: '12px', border: '2px solid #57CC86',
                  background: '#E6F7EF', color: '#047857', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'left' }}>
                🍱 组成一个套餐 — 先合成套餐图再修图
              </button>
              <button onClick={() => { setComboMode('individual'); setShowComboChoice(false) }}
                style={{ padding: '14px 20px', borderRadius: '12px', border: '1px solid #E5E7EB',
                  background: '#fff', color: '#374151', fontSize: '14px', fontWeight: 600,
                  cursor: 'pointer', textAlign: 'left' }}>
                🍽️ 各自独立设计 — 逐张修图和生成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 多图缩略图导航（独立模式下） */}
      {originalImages.length > 1 && comboMode === 'individual' && (
        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 8px' }}>
            当前处理第 {currentImageIndex + 1}/{originalImages.length} 张
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {originalImages.map((img, i) => (
              <div key={i} onClick={() => { setCurrentImageIndex(i); setOriginalImage(img.b64); setEnhancedImage(null) }}
                style={{ width: '48px', height: '48px', borderRadius: '8px', overflow: 'hidden',
                  border: i === currentImageIndex ? '2px solid #57CC86' : '1px solid #E5E7EB',
                  cursor: 'pointer', opacity: i === currentImageIndex ? 1 : 0.6 }}>
                <img src={img.b64} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传区 */}
      {!originalImage ? (
        <div onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed #D1D5DB', borderRadius: '16px', padding: '48px 24px',
            textAlign: 'center', cursor: 'pointer', background: '#FAFAFA',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#57CC86')}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#D1D5DB')}>
          <Upload size={40} style={{ color: '#9CA3AF', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            点击上传菜品实拍图
          </p>
          <p style={{ fontSize: '12.5px', color: '#9CA3AF', margin: 0 }}>
            支持 JPG/PNG/WebP，建议尺寸 ≥ 512×512（可多选）
          </p>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={handleFileUpload} style={{ display: 'none' }} />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* 原图预览 */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', margin: '0 0 10px' }}>
              📷 原始图片
            </h3>
            <div style={{
              borderRadius: '12px', overflow: 'hidden', border: '1px solid #E5E7EB',
              position: 'relative', paddingBottom: '100%', background: '#F9FAFB',
            }}>
              <img src={originalImage} alt="原图"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '6px 0 0' }}>
              {imageFileName}
            </p>
            <button onClick={() => { setOriginalImage(null); setEnhancedImage(null); setImageFileName('') }}
              style={{
                marginTop: '8px', padding: '6px 14px', borderRadius: '8px',
                border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280',
                fontSize: '12px', cursor: 'pointer',
              }}>
              重新选择
            </button>
          </div>

          {/* 修图结果 */}
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#6B7280', margin: '0 0 10px' }}>
              ✨ AI智能修图{enhancedImage ? '✅ 已完成' : stepSkipped ? '⏭ 已跳过' : ''}
            </h3>
            {enhancedImage ? (
              /* ✅ 成功状态 */
              <>
                <div style={{
                  borderRadius: '12px', overflow: 'hidden', border: '2px solid #57CC86',
                  position: 'relative', paddingBottom: '100%',
                }}>
                  <img src={`data:image/png;base64,${enhancedImage}`} alt="修图结果"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button onClick={handleEnhance} disabled={isEnhancing}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid #57CC86',
                      background: isEnhancing ? '#D1FAE5' : '#57CC86', color: '#fff',
                      fontSize: '12.5px', cursor: isEnhancing ? 'wait' : 'pointer', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                    <RefreshCw size={14} style={isEnhancing ? { animation: 'spin 1s linear infinite' } : {}} />
                    {isEnhancing ? '正在修图...' : '重新修图'}
                  </button>
                </div>
              </>
            ) : enhanceError && !isEnhancing ? (
              /* ❌ 错误状态 */
              <div style={{
                borderRadius: '12px', border: '1.5px solid #6EE7B7', background: '#ECFDF5',
                padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center',
              }}>
                <p style={{ fontSize: '13px', color: '#059669', margin: 0, textAlign: 'center', fontWeight: 500 }}>
                  ⚠️ {enhanceError}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { setEnhanceError(null); handleEnhance(); }}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: 'none',
                      background: '#57CC86', color: '#fff', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                    🔄 重试
                  </button>
                  <button onClick={handleSkipStep}
                    style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid #D1D5DB',
                      background: '#fff', color: '#6B7280', fontSize: '13px', cursor: 'pointer' }}>
                    跳过此步 →
                  </button>
                </div>
              </div>
            ) : isEnhancing ? (
              /* 🔄 进行中状态 */
              <div style={{
                borderRadius: '12px', border: '2px dashed #57CC86',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '200px', background: '#ECFDF5', gap: '12px',
              }}>
                <Wand2 size={32} style={{ color: '#57CC86', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '14px', color: '#059669', margin: 0, fontWeight: 600 }}>
                  AI修图中... ({enhanceElapsed}s / 120s超时)
                </p>
                <p style={{ fontSize: '11px', color: '#9CA3AF', margin: 0 }}>
                  AI 生图中，通常需要30-60秒
                </p>
                <button onClick={handleCancelEnhance}
                  style={{
                    padding: '6px 20px', borderRadius: '8px',
                    border: '1px solid #6EE7B7', background: '#fff', color: '#059669',
                    fontSize: '12px', cursor: 'pointer', fontWeight: 500,
                  }}>
                  ✕ 停止等待
                </button>
                <button onClick={handleSkipStep}
                  style={{
                    padding: '4px 14px', borderRadius: '6px', border: 'none',
                    background: 'transparent', color: '#9CA3AF', fontSize: '11px', cursor: 'pointer'
                  }}>
                  不等了，跳过用原图 →
                </button>
              </div>
            ) : (
              /* 📷 初始状态（未开始） */
              <div style={{
                borderRadius: '12px', border: '2px dashed #D1D5DB',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                minHeight: '200px', background: '#FAFAFA', gap: '12px',
              }}>
                <Sparkles size={32} style={{ color: '#D1D5DB' }} />
                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0, textAlign: 'center' }}>
                  点击下方按钮进行AI智能修图<br/>
                  自动提亮、去杂背景、强化主体
                </p>
                <button onClick={handleEnhance}
                  style={{
                    padding: '10px 24px', borderRadius: '10px', border: 'none',
                    background: '#57CC86', color: '#fff',
                    fontSize: '14px', cursor: 'pointer', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                  <Wand2 size={16} />
                  🪄 一键AI智能修图
                </button>
                <button onClick={handleSkipStep}
                  style={{
                    padding: '4px 14px', borderRadius: '6px', border: 'none',
                    background: 'transparent', color: '#9CA3AF', fontSize: '11px', cursor: 'pointer'
                  }}>
                  跳过，直接用原图 →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  // ════════════════════════════════════════
  // STEP 4: 文案收集
  // ════════════════════════════════════════
  const renderStep4 = () => (
    <div style={{ padding: '28px 36px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        📝 填写菜品核心信息
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 24px' }}>
        信息越详细，生成的图片越符合预期。支持模板化快速填写。
      </p>

      <div style={{ background: '#FAFAFA', borderRadius: '12px', padding: '24px', border: '1px solid #F3F4F6' }}>
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            菜品名称 <span style={{ color: '#57CC86' }}>*</span>
          </label>
          <input value={dishInfo.name}
            onChange={(e) => setDishInfo({ ...dishInfo, name: e.target.value })}
            placeholder="例如：招牌麻辣香锅"
            style={{ ...inputStyle, width: '100%' }} />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            核心卖点
          </label>
          <textarea value={dishInfo.sellingPoints}
            onChange={(e) => setDishInfo({ ...dishInfo, sellingPoints: e.target.value })}
            placeholder="提示方向：优势原材料、口味特点、规格分量、制作工艺等&#10;&#10;示例：精选澳洲肥牛 + 手工现制宽粉，麻辣鲜香，分量十足够3人吃"
            rows={3} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            价格信息（可选）
          </label>
          <input value={dishInfo.price || ''}
            onChange={(e) => setDishInfo({ ...dishInfo, price: e.target.value })}
            placeholder="例如：¥68 / ¥88（原价¥128）"
            style={{ ...inputStyle, width: '100%' }} />
        </div>

        <div>
          <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
            主打宣传文案（可选）
          </label>
          <textarea value={dishInfo.promoText}
            onChange={(e) => setDishInfo({ ...dishInfo, promoText: e.target.value })}
            placeholder="一句话打动顾客的文案&#10;&#10;示例：一口入魂的江湖味，不吃后悔一整年！"
            rows={2} style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
          <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '6px 0 0' }}>
            💡 可留空，系统会根据菜品特点智能推荐爆款广告语
          </p>
        </div>
      </div>

      {/* 改动4 + 改动6：输出选项 */}
      <div style={{
        marginTop: '20px', background: '#F0FDF4', borderRadius: '12px',
        padding: '18px 22px', border: '1px solid #A7F3D0',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#047857', margin: '0 0 12px' }}>
          🎯 输出选项（影响生成数量）
        </h3>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
          padding: '10px 12px', borderRadius: '8px',
          background: generateBothVariants ? '#D1FAE5' : '#FFF',
          border: `1px solid ${generateBothVariants ? '#34D399' : '#E5E7EB'}`,
          marginBottom: '10px',
        }}>
          <input type="checkbox" checked={generateBothVariants}
            onChange={(e) => setGenerateBothVariants(e.target.checked)}
            style={{ marginTop: '2px', accentColor: '#57CC86' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
              同时输出 2 个风格变体（简约 + 活力）
            </div>
            <div style={{ fontSize: '11.5px', color: '#6B7280', marginTop: '3px' }}>
              简约：留白克制，突出主体 / 活力：撞色冲击，烟火气浓 — 每位置 ×2
            </div>
          </div>
        </label>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer',
          padding: '10px 12px', borderRadius: '8px',
          background: generateNoText ? '#D1FAE5' : '#FFF',
          border: `1px solid ${generateNoText ? '#34D399' : '#E5E7EB'}`,
        }}>
          <input type="checkbox" checked={generateNoText}
            onChange={(e) => setGenerateNoText(e.target.checked)}
            style={{ marginTop: '2px', accentColor: '#57CC86' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
              额外输出"不带文字"纯图版
            </div>
            <div style={{ fontSize: '11.5px', color: '#6B7280', marginTop: '3px' }}>
              方便后期自由排版/二次设计 — 每位置再 ×2
            </div>
          </div>
        </label>

        <div style={{
          marginTop: '12px', padding: '10px 12px', background: '#FFF',
          borderRadius: '8px', border: '1px dashed #34D399',
          fontSize: '12px', color: '#047857',
        }}>
          📊 本次预计生成：<b style={{ fontSize: '14px' }}>
            {selectedPositions.size * (generateBothVariants ? 2 : 1) * (generateNoText ? 2 : 1)}
          </b> 张
          （{selectedPositions.size} 位置 × {generateBothVariants ? 2 : 1} 风格 × {generateNoText ? 2 : 1} 文字版本）
          <span style={{ marginLeft: '10px', color: '#9CA3AF' }}>
            今日剩余额度：{Math.max(0, DAILY_LIMIT - getDailyCount())}/{DAILY_LIMIT}
          </span>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════
  // STEP 5: 批量生成
  // ════════════════════════════════════════
  const renderStep5 = () => {
    // 实际任务总数 = 位置 × 风格变体 × 文字版本
    const variantCount = generateBothVariants ? 2 : 1;
    const textVersionCount = generateNoText ? 2 : 1;
    const totalTasks = selectedPositions.size * variantCount * textVersionCount;
    const platformCount = [...selectedPositions].reduce((acc, k) => { const pk = k.split(':')[0]; return acc.add(pk); }, new Set<string>()).size;

    return (
    <div style={{ padding: '28px 36px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        🪄 一键批量生成
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>
        系统将整合品牌VI + 平台规格 + 优化后的菜品图 + 卖点信息，一次性生成所有已选平台的专属图片
      </p>

      {/* 汇总信息卡片 */}
      <div style={{
        background: 'linear-gradient(135deg, #E6F7EF 0%, #FFF 100%)',
        borderRadius: '12px', padding: '18px 22px', marginBottom: '24px',
        border: '1px solid #A7F3D0',
      }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#047857', margin: '0 0 12px' }}>生成任务汇总</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px', color: '#374151' }}>
          <div>🏷️ 品牌：<b>{brand.brandName || '-'}</b></div>
          <div>🍽️ 菜品：<b>{dishInfo.name || '-'}</b></div>
          <div>🎨 风格：<b>{STYLE_PRESETS.find(s => s.key === brand.stylePreference)?.label.split(' ')[1] || '-'}</b></div>
          <div>📱 生成数量：<b>{totalTasks} 张</b>（{platformCount} 个平台 · {selectedPositions.size} 位置 × {variantCount} 风格 × {textVersionCount} 文字版）</div>
        </div>
        <div style={{
          marginTop: '10px', padding: '8px 12px', background: '#FFF',
          borderRadius: '6px', border: '1px dashed #34D399',
          fontSize: '11.5px', color: '#047857',
        }}>
          ⚡ 今日剩余额度：<b>{Math.max(0, DAILY_LIMIT - getDailyCount())}/{DAILY_LIMIT}</b>
          {totalTasks > Math.max(0, DAILY_LIMIT - getDailyCount()) && (
            <span style={{ marginLeft: '10px', color: '#DC2626', fontWeight: 600 }}>
              ⚠️ 超出今日额度，请减少位置或关闭风格变体/文字版选项
            </span>
          )}
        </div>
      </div>

      {/* 生成按钮 */}
      {!isGenerating && generatedImages.length === 0 && (
        <button onClick={handleBatchGenerate}
          disabled={totalTasks === 0 || totalTasks > Math.max(0, DAILY_LIMIT - getDailyCount())}
          style={{
            width: '100%', padding: '18px', borderRadius: '14px', border: 'none',
            background: (totalTasks === 0 || totalTasks > Math.max(0, DAILY_LIMIT - getDailyCount()))
              ? '#D1D5DB'
              : 'linear-gradient(135deg, #57CC86 0%, #047857 100%)',
            color: '#fff', fontSize: '16px', fontWeight: 700,
            cursor: (totalTasks === 0 || totalTasks > Math.max(0, DAILY_LIMIT - getDailyCount())) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            boxShadow: '0 4px 16px rgba(87,204,134,0.3)',
          }}>
          <Wand2 size={22} /> 开始批量生成（{totalTasks} 张）
        </button>
      )}

      {/* 生成进度 */}
      {isGenerating && (
        <div style={{
          padding: '24px', textAlign: 'center', background: '#FAFAFA',
          borderRadius: '12px', border: '1px solid #F3F4F6',
        }}>
          <RefreshCw size={36} style={{ color: '#57CC86', animation: 'spin 1.5s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>
            正在生成中...
          </p>
          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>
            {generatedImages.filter(i => i.status === 'done').length} / {generatedImages.length} 完成
          </p>
          <div style={{
            width: '100%', height: '6px', background: '#E5E7EB', borderRadius: '3px',
            marginTop: '14px', overflow: 'hidden',
          }}>
            <div style={{
              width: `${(generatedImages.filter(i => i.status === 'done').length / Math.max(generatedImages.length, 1)) * 100}%`,
              height: '100%', background: 'linear-gradient(90deg, #57CC86, #F472B6)',
              borderRadius: '3px', transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* 已完成 → 直接进入下一步 */}
      {!isGenerating && generatedImages.length > 0 &&
        generatedImages.every(i => i.status === 'done' || i.status === 'error') && (
        <div style={{ textAlign: 'center', paddingTop: '12px' }}>
          <p style={{ fontSize: '14px', color: '#059669', fontWeight: 600, margin: '0 0 16px' }}>
            ✅ 生成完成！共 {generatedImages.filter(i => i.status === 'done').length} 张成功，
            {generatedImages.filter(i => i.status === 'error').length} 张需重试
          </p>
          <button onClick={() => setCurrentStep(6)}
            style={{
              padding: '12px 32px', borderRadius: '10px', border: 'none',
              background: '#059669', color: '#fff', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
            }}>
            查看生成结果 →
          </button>
        </div>
      )}

      {/* 错误重试入口 */}
      {generatedImages.some(i => i.status === 'error') && !isGenerating && (
        <div style={{ marginTop: '16px', padding: '12px 16px', background: '#ECFDF5', borderRadius: '10px' }}>
          <p style={{ fontSize: '12.5px', color: '#059669', margin: '0 0 8px' }}>
            ⚠️ 部分图片生成失败，可进入下一步单独重绘
          </p>
        </div>
      )}
    </div>
  );
  };

  // ════════════════════════════════════════
  // STEP 6: 展示 & 调整
  // ════════════════════════════════════════
  const renderStep6 = () => (
    <div style={{ padding: '28px 36px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        👁️ 生成结果预览
      </h2>
      <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 20px' }}>
        按平台分组展示，支持单张独立重绘或下载
      </p>

      {generatedImages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9CA3AF' }}>
          <Grid3X3 size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, margin: 0 }}>还没有生成图片</p>
          <p style={{ fontSize: '13px', margin: '6px 0 0' }}>返回上一步开始批量生成</p>
          <button onClick={() => setCurrentStep(5)}
            style={{ marginTop: '14px', padding: '8px 20px', borderRadius: '8px', border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer' }}>
            ← 返回批量生成
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
          {generatedImages.map(img => (
            <div key={img.id} style={{
              borderRadius: '14px', border: `2px solid ${
                img.status === 'done' ? '#D1FAE5' : img.status === 'error' ? '#D1FAE5' : '#F3F4F6'
              }`,
              background: '#fff', overflow: 'hidden',
            }}>
              {/* 平台标签 */}
              <div style={{
                padding: '8px 14px', fontSize: '12px', fontWeight: 600,
                background: img.status === 'done' ? '#ECFDF5' : img.status === 'error' ? '#ECFDF5' : '#F9FAFB',
                borderBottom: `1px solid ${img.status === 'done' ? '#A7F3D0' : img.status === 'error' ? '#FECACA' : '#F3F4F6'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ color: img.status === 'done' ? '#059669' : img.status === 'error' ? '#059669' : '#6B7280' }}>
                  {img.platformLabel}
                </span>
                <span style={{ fontSize: '10.5px', color: '#9CA3AF' }}>{img.size}</span>
              </div>

              {/* 图片预览 */}
              <div style={{ position: 'relative', paddingBottom: '75%', background: '#F9FAFB' }}>
                {img.status === 'generating' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}>
                    <RefreshCw size={24} style={{ color: '#57CC86', animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>生成中...</span>
                  </div>
                )}
                {img.status === 'done' && img.b64Data && (
                  <img src={`data:image/png;base64,${img.b64Data}`} alt={img.platformLabel}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
                {img.status === 'error' && (
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#059669',
                  }}>
                    <AlertCircle size={24} />
                    <span style={{ fontSize: '12px', textAlign: 'center', padding: '0 12px' }}>
                      {img.error || '生成失败'}
                    </span>
                  </div>
                )}
              </div>

              {/* 操作栏 */}
              <div style={{
                padding: '10px 14px', display: 'flex', gap: '8px',
                borderTop: '1px solid #F3F4F6',
              }}>
                {img.status === 'done' && (
                  <>
                    <button onClick={() => downloadSingle(img)} style={{
                      flex: 1, padding: '6px 0', borderRadius: '6px', border: 'none',
                      background: '#F0FDF4', color: '#059669', fontSize: '12px',
                      cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    }}>
                      <Download size={13} /> 下载
                    </button>
                    <button onClick={() => handleRegenerate(img.id)} style={{
                      padding: '6px 12px', borderRadius: '6px', border: '1px solid #E5E7EB',
                      background: '#fff', color: '#6B7280', fontSize: '12px',
                      cursor: 'pointer',
                    }}>
                      <RefreshCw size={13} />
                    </button>
                  </>
                )}
                {img.status === 'error' && (
                  <button onClick={() => handleRegenerate(img.id)} style={{
                    width: '100%', padding: '6px 0', borderRadius: '6px', border: 'none',
                    background: '#ECFDF5', color: '#059669', fontSize: '12px',
                    cursor: 'pointer', fontWeight: 600,
                  }}>
                    <RefreshCw size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} /> 重新生成
                  </button>
                )}
                {img.status === 'generating' && (
                  <div style={{ width: '100%', textAlign: 'center', fontSize: '12px', color: '#9CA3AF' }}>
                    <RefreshCw size={13} style={{ verticalAlign: '-2px', animation: 'spin 1s linear inline' }} /> 处理中...
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ════════════════════════════════════════
  // STEP 7: 下载存档
  // ════════════════════════════════════════
  const renderStep7 = () => {
    const doneCount = generatedImages.filter(i => i.status === 'done').length
    return (
      <div style={{ padding: '28px 36px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
          💾 下载 & 存档
        </h2>
        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 24px' }}>
          高清无水印，直接商用。文件命名：【平台_菜品名_尺寸】
        </p>

        {/* 成功统计 */}
        <div style={{
          background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDF4 100%)',
          borderRadius: '14px', padding: '24px', marginBottom: '24px',
          border: '1px solid #A7F3D0', textAlign: 'center',
        }}>
          <div style={{ fontSize: '42px', fontWeight: 800, color: '#059669', lineHeight: 1 }}>{doneCount}</div>
          <div style={{ fontSize: '14px', color: '#047857', marginTop: '4px' }}>张图片待下载</div>
          <div style={{ fontSize: '12px', color: '#6EE7B7', marginTop: '2px' }}>
            全部为 PNG 格式，符合各平台上传规格
          </div>
        </div>

        {/* 批量下载按钮 */}
        {doneCount > 0 && (
          <button onClick={downloadAll}
            style={{
              width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: '#fff', fontSize: '16px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              boxShadow: '0 4px 16px rgba(5,150,105,0.3)', marginBottom: '20px',
            }}>
            <Download size={22} /> 批量下载全部（{doneCount} 张）
          </button>
        )}

        {/* 缩略图列表 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px',
        }}>
          {generatedImages.filter(i => i.status === 'done').map(img => (
            <div key={img.id} style={{
              borderRadius: '10px', overflow: 'hidden', border: '1px solid #E5E7EB',
              cursor: 'pointer', position: 'relative', paddingBottom: '100%',
            }}
              onClick={() => downloadSingle(img)}>
              <img src={`data:image/png;base64,${img.b64Data}`} alt=""
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, padding: '4px 8px',
                background: 'rgba(0,0,0,0.55)', fontSize: '10px', color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {img.platformLabel}.png
              </div>
            </div>
          ))}
        </div>

        {/* 使用指南提示 */}
        <div style={{
          marginTop: '24px', padding: '18px 20px', background: '#FFFBEB',
          borderRadius: '12px', border: '1px solid #FDE68A',
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', margin: '0 0 8px' }}>
            📌 各平台上传提示
          </h3>
          <ul style={{ fontSize: '12px', color: '#A16207', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
            <li><b>美团外卖：</b>商家后台→菜品管理→上传菜品图（推荐1024×768以上）</li>
            <li><b>美团点评：</b>商户中心→相册管理→上传环境/菜品图（正方形最佳）</li>
            <li><b>抖音来客：</b>POI管理→店铺装修→上传轮播/头图</li>
            <li><b>高德地图：</b>商家入驻→店铺信息→上传门头/内景图</li>
            <li>💡 所有图片均已按各平台安全区规范生成，无需二次裁剪</li>
          </ul>
        </div>

        {/* 完成按钮 — 返回第一步做下一组 */}
        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #F3F4F6' }}>
          <button onClick={() => {
            setCurrentStep(1)
            setGeneratedImages([])
            setDishInfo({ name: '', sellingPoints: '', promoText: '', price: '' })
            setOriginalImage(null)
            setEnhancedImage(null)
          }}
            style={{
              padding: '12px 32px', borderRadius: '10px', border: '1px solid #E5E7EB',
              background: '#fff', color: '#374151', fontSize: '14px',
              fontWeight: 600, cursor: 'pointer',
            }}>
            🔄 继续设计下一组图片
          </button>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════
  // 主渲染
  // ════════════════════════════════════════
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: return renderStep1()
      case 2: return renderStep2()
      case 3: return renderStep3()
      case 4: return renderStep4()
      case 5: return renderStep5()
      case 6: return renderStep6()
      case 7: return renderStep7()
      default: return null
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: '#F9FAFB', overflow: 'hidden',
    }}>
      {/* 顶部标题栏 */}
      <div style={{
        padding: '16px 32px', background: '#fff', borderBottom: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #57CC86 0%, #F472B6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', color: '#fff',
          }}>🎨</div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0, lineHeight: 1.2 }}>
              图片设计专家
            </h1>
            <p style={{ fontSize: '11.5px', color: '#9CA3AF', margin: '2px 0 0' }}>
              AI一键生成全平台商用菜品图
            </p>
          </div>
        </div>
        <span style={{
          padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
          background: '#E6F7EF', color: '#57CC86', border: '1px solid #A7F3D0',
        }}>
          AI
        </span>
      </div>

      {/* 步骤指示器 */}
      {renderStepIndicator()}

      {/* 内容区 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        {renderStepContent()}
      </div>

      {/* 底部导航按钮 */}
      <div style={{
        padding: '14px 32px', background: '#fff', borderTop: '1px solid #F3F4F6',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <button onClick={goBack} disabled={currentStep <= 1}
          style={{
            padding: '10px 24px', borderRadius: '10px', border: currentStep <= 1 ? '1px solid #F3F4F6' : '1px solid #D1D5DB',
            background: '#fff', color: currentStep <= 1 ? '#D1D5DB' : '#374151',
            fontSize: '13.5px', fontWeight: 600, cursor: currentStep <= 1 ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
          <ChevronLeft size={16} /> 上一步
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
            第 {currentStep} / {STEPS.length} 步
          </span>
          {currentStep < 7 ? (
            <button onClick={goNext} disabled={!canGoNext()}
              style={{
                padding: '10px 28px', borderRadius: '10px', border: 'none',
                background: canGoNext() ? 'linear-gradient(135deg,#57CC86,#047857)' : '#E5E7EB',
                color: canGoNext() ? '#fff' : '#9CA3AF',
                fontSize: '13.5px', fontWeight: 700, cursor: canGoNext() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
              下一步 <ChevronRight size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* CSS动画注入 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── 共享样式常量 ───
const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '10px', border: '1px solid #D1D5DB',
  fontSize: '13.5px', outline: 'none', color: '#1f2937', background: '#fff',
  boxSizing: 'border-box', width: '100%',
  transition: 'border-color 0.2s',
} as React.CSSProperties
