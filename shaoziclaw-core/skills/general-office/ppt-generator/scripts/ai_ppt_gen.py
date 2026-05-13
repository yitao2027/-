# -*- coding: utf-8 -*-
"""
AI PPT Generator - 每页由大模型设计，风格统一
基于蓝湘子项目实战优化
"""
import os
import asyncio
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches

# ==================== 配置 ====================
BRAND_NAME = "蓝湘子"
BRAND_EN = "Lan Xiang Zi"
BRAND_COLORS = {
    "primary": "#1B4FAB",      # 绅士蓝
    "secondary": "#3B7DD8",    # 浅蓝
    "accent": "#C8A840",       # 金色
    "dark": "#0a1e50",         # 深色背景
    "light": "#faf8f3",        # 浅色背景
}
IMG_DIR = r"C:\Users\15810\.openclaw\workspace\skills\catering-ppt\assets\images"

# ==================== 风格指南模板 ====================
STYLE_GUIDE = """
## 统一风格规范
- 主色: {primary}
- 辅助色: {secondary}
- 强调色: {accent}
- 字体: Microsoft YaHei, 微软雅黑
- 背景: 渐变或纯色，配合微妙纹理
- 布局: 卡片式、留白充足
- 设计感: 专业商业风格，非简陋排版
"""

# ==================== 每页内容模板 ====================
SLIDES_CONTENT = [
    {
        "page": 1,
        "title": "封面",
        "template": "cover",
        "data": {
            "brand": BRAND_NAME,
            "brand_en": BRAND_EN,
            "tagline": "让大牌湘菜走进千家万户",
            "stats": ["400+门店", "97+城市", "5000万+人次", "7年"]
        }
    },
    {
        "page": 2,
        "title": "品牌故事",
        "template": "story",
        "data": {
            "year": "2019",
            "city": "西安",
            "milestones": [
                ("2019", "西安创立", "湖南菜大众化先行者"),
                ("2023", "高速增长", "80+城市 · 250+门店"),
                ("2026", "今日成就", "400+门店 · 97+城市")
            ]
        }
    },
    {
        "page": 3,
        "title": "品牌定位",
        "template": "positioning",
        "data": {
            "slogan": "高端大牌 · 平民价格",
            "pillars": [
                ("🎯", "目标客群", "25-45岁城市白领\n追求品质与性价比"),
                ("🍽", "产品定位", "正宗湖南家常菜\n招牌菜品标准化"),
                ("💰", "价格定位", "人均60-100元\n成本优势30%")
            ]
        }
    },
    {
        "page": 4,
        "title": "发展历程",
        "template": "timeline",
        "data": {
            "events": [
                ("2019", "西安创立", "原点"),
                ("2021", "全国布局", "50+门店"),
                ("2023", "高速增长", "250+门店"),
                ("2026", "行业领先", "400+门店")
            ]
        }
    },
    {
        "page": 5,
        "title": "核心数据",
        "template": "data_cards",
        "data": {
            "numbers": [
                ("400+", "直营门店", "遍布全国核心商圈"),
                ("97+", "覆盖城市", "一二三线城市全覆盖"),
                ("5000万+", "年均用餐人次", "深受食客信赖")
            ],
            "stats": [("98%", "顾客满意度"), ("4.8分", "平均评分"), ("65%", "回头客比例")]
        }
    },
    {
        "page": 6,
        "title": "招牌菜品",
        "template": "dishes_grid",
        "data": {
            "dishes": [
                ("dish_1.png", "剁椒鱼头", "湖南经典名菜"),
                ("dish_2.png", "口味小龙虾", "秘制口味虾"),
                ("dish_3.png", "毛血旺", "川湘融合经典"),
                ("dish_4.png", "农家小炒肉", "地道家常味道")
            ]
        }
    },
    {
        "page": 7,
        "title": "门店体验",
        "template": "features",
        "data": {
            "features": [
                ("🏠", "极致空间", "新中式湘西风格设计"),
                ("👨‍🍳", "专业厨师", "来自湖南正宗团队"),
                ("🚀", "极速出餐", "高峰期15分钟内上菜"),
                ("✅", "食品安全", "食材每日直送可追溯")
            ]
        }
    },
    {
        "page": 8,
        "title": "全国布局",
        "template": "coverage",
        "data": {
            "big_number": "400",
            "label": "直营门店",
            "stats": [
                ("97+城市", "一二三线全覆盖"),
                ("华北/华东/华南/西南", "全区域均衡布局"),
                ("每月开店2-3家", "扩张提速中")
            ]
        }
    },
    {
        "page": 9,
        "title": "加盟优势",
        "template": "advantages",
        "data": {
            "items": [
                ("1", "品牌赋能", "7年品牌积累\n400+门店验证"),
                ("2", "总部支持", "选址评估指导\n装修设计支持"),
                ("3", "培训体系", "标准化培训\n厨师技能培训"),
                ("4", "供应链保障", "中央厨房直供\n食材成本降低30%")
            ],
            "roi": [("18-24个月", "投资回报期"), ("15-25%", "年净利润率"), ("50万起", "最低投资门槛")]
        }
    },
    {
        "page": 10,
        "title": "加入我们",
        "template": "contact",
        "data": {
            "title": "加入我们",
            "subtitle": "共创湘菜连锁新未来",
            "contact": [
                ("官方网站", "www.lanxiangzi.com"),
                ("加盟热线", "400-XXX-XXXX"),
                ("总部地址", "陕西省西安市")
            ]
        }
    }
]

# ==================== HTML生成提示词模板 ====================
HTML_PROMPT = """
你是一个专业PPT设计师。为品牌「{brand}」设计第{page}页幻灯片。

## 统一风格规范（必须遵守）
{style_guide}

## 页面信息
- 标题: {title}
- 模板类型: {template}
- 页面数据: {data}

## 要求
1. 使用上述风格规范
2. 设计专业、有设计感
3. 背景使用渐变或纯色
4. 卡片/组件有阴影和圆角
5. 文字清晰可读
6. 输出完整HTML代码（1280x720px）

## 图片路径
- 可用图片目录: {img_dir}
- 使用file:///协议引用本地图片

请生成这页的HTML代码。
"""

def generate_page_prompt(brand, page_info, style_guide, img_dir):
    """生成单页提示词"""
    return HTML_PROMPT.format(
        brand=brand,
        page=page_info["page"],
        title=page_info["title"],
        template=page_info["template"],
        data=str(page_info["data"]),
        style_guide=style_guide,
        img_dir=img_dir
    )

# ==================== 主流程 ====================

def create_ppt(brand_name, slides_content, brand_colors, img_dir, output_path):
    """创建PPT主流程"""
    print(f"开始生成 {brand_name} PPT...")
    
    # 1. 生成风格指南
    style_guide = STYLE_GUIDE.format(**brand_colors)
    
    # 2. 为每页生成HTML（这里需要调用大模型）
    # 在实际使用中，每页调用一次大模型生成HTML
    # for slide in slides_content:
    #     prompt = generate_page_prompt(brand_name, slide, style_guide, img_dir)
    #     html = call_llm(prompt)  # 调用大模型
    #     save_html(html, f"slide_{slide['page']}.html")
    
    # 3. 截图（使用Playwright）
    # screenshots = capture_all_slides()
    
    # 4. 组装PPTX
    prs = Presentation()
    prs.slide_width = Inches(13.33)
    prs.slide_height = Inches(7.5)
    
    # for img in screenshots:
    #     slide = prs.slides.add_slide(prs.slide_layouts[6])
    #     slide.shapes.add_picture(img, 0, 0, Inches(13.33), Inches(7.5))
    
    # prs.save(output_path)
    # print(f"PPT已保存: {output_path}")

if __name__ == "__main__":
    create_ppt(BRAND_NAME, SLIDES_CONTENT, BRAND_COLORS, IMG_DIR, "output.pptx")
