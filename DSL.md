# DSL 组件树（总控台-审批面板）

```json
{
  "component": "RightSidebarPanel",
  "props": { "theme": "dark", "layout": "flex", "direction": "column", "height": "100%" },
  "children": [
    {
      "component": "Tabs",
      "props": { "activeKey": "approval" },
      "children": [
        { "component": "TabItem", "props": { "title": "概览" } },
        { "component": "TabItem", "props": { "title": "审批", "badge": "2" } },
        { "component": "TabItem", "props": { "title": "工单" } },
        { "component": "TabItem", "props": { "title": "事件" } },
        { "component": "TabItem", "props": { "title": "来源" } },
        { "component": "TabItem", "props": { "title": "设置" } }
      ]
    },
    {
      "component": "FilterBar",
      "props": {
        "layout": "flex",
        "direction": "row",
        "justify": "space-between",
        "align": "center",
        "padding": "8px 16px"
      },
      "children": [
        {
          "component": "LeftActionWrapper",
          "props": {
            "layout": "flex",
            "direction": "row",
            "overflowX": "auto",
            "flexShrink": 1,
            "hideScrollbar": true 
          },
          "children": [
            {
              "component": "SegmentedControl",
              "children": [
                { "component": "Button", "props": { "text": "待审批", "active": true } },
                { "component": "Button", "props": { "text": "已通过" } },
                { "component": "Button", "props": { "text": "全部" } }
              ]
            }
          ]
        },
        {
          "component": "RightToolWrapper",
          "props": {
            "layout": "flex",
            "direction": "row",
            "align": "center",
            "gap": "8px",
            "flexShrink": 0 
          },
          "children": [
            { "component": "Dropdown", "props": { "placeholder": "时间范围" } },
            { "component": "SearchInput", "props": { "placeholder": "搜索", "icon": "search" } },
            { "component": "IconButton", "props": { "icon": "help" } }
          ]
        }
      ]
    },
    {
      "component": "ListView",
      "props": { "layout": "flex", "direction": "column", "overflowY": "auto", "flex": 1, "gap": "12px", "padding": "16px" },
      "children": [
        {
          "component": "ListItemCard",
          "props": { "status": "collapsed" },
          "children": [
            {
              "component": "CardHeader",
              "props": { "layout": "flex", "justify": "space-between", "align": "center" },
              "children": [
                { "component": "Text", "props": { "text": "发起者: 代理名称 关联工单: 工单名称" } },
                { "component": "Text", "props": { "text": "11月12日 00:22" } },
                { "component": "Icon", "props": { "type": "chevron-right" } }
              ]
            },
            {
              "component": "CardBody",
              "children": [
                { "component": "Text", "props": { "text": "这是一个三选项测试题。请选择一项..." } }
              ]
            }
          ]
        },
        {
          "component": "ListItemCard",
          "props": { "status": "expanded" },
          "children": [
            {
              "component": "CardHeader",
              "props": { "layout": "flex", "justify": "space-between", "align": "center" },
              "children": [
                { "component": "Text", "props": { "text": "发起者: 代理名称 关联工单: 工单名称" } },
                { "component": "Text", "props": { "text": "11月12日 00:22" } },
                { "component": "Icon", "props": { "type": "chevron-up" } }
              ]
            },
            {
              "component": "CardBody",
              "props": { "layout": "flex", "direction": "column", "gap": "12px" },
              "children": [
                { 
                  "component": "DescriptionText", 
                  "props": { "text": "这是一个三选项测试题。请选择一项（每个选项的 label 是「选项标签」，description 是「选项说明」，字段内容已按工具要求填写）。" } 
                },
                {
                  "component": "OptionList",
                  "props": { "layout": "flex", "direction": "column", "gap": "8px" },
                  "children": [
                    { 
                      "component": "OptionItem", 
                      "props": { "index": 1, "label": "选项 A", "desc": "选择 A 表示同意方案一的处理方式，此说明展示第二个字段的填写内容。" } 
                    },
                    { 
                      "component": "OptionItem", 
                      "props": { "index": 2, "label": "选项 B", "desc": "选择 B 表示采用方案二的处理方式，用于对比不同选项的显示效果。" } 
                    },
                    { 
                      "component": "OptionItem", 
                      "props": { "index": 3, "label": "选项 C", "desc": "选择 C 表示暂缓执行、稍后再决定，展示第三个选项的完整字段内容。" } 
                    }
                  ]
                },
                { 
                  "component": "InputArea", 
                  "props": { "placeholder": "输入你的答案", "icon": "edit" } 
                },
                { 
                  "component": "AttachmentArea", 
                  "props": { "text": "附件: 文件1 文件2 文件3 (点击可在右侧栏浏览和编辑文件)，可选填非必填，未填不显示该项", "icon": "attachment" } 
                }
              ]
            },
            {
              "component": "CardFooter",
              "props": { "layout": "flex", "justify": "space-between", "align": "center", "borderTop": "1px solid #333" },
              "children": [
                { 
                  "component": "Pagination", 
                  "props": { "current": 1, "total": 1 } 
                },
                { 
                  "component": "ButtonGroup",
                  "props": { "layout": "flex", "gap": "8px" },
                  "children": [
                    { "component": "Button", "props": { "text": "跳过", "type": "default" } },
                    { "component": "Button", "props": { "text": "提交", "type": "primary" } }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## 界面结构详细解释：

这个右侧面板是一个典型的**任务审批/工单处理中心**，从上到下分为三个核心区域：

### 1. 顶部导航区 (Tabs)（固定顶栏）
*   **组件**：`Tabs` (标签页)。
*   **说明**：包含了“概览、审批、工单、事件、来源、设置”六个分类。当前处于“审批”分类（有下划线高亮），并且“审批”文字旁边有一个红色的数字角标 **`2`**，提示当前有 2 个待审批事件。

### 2. 过滤与操作栏 (FilterBar)（固定操作栏）
*   **左侧**：`SegmentedControl` (分段控制器/按钮组)，提供“待审批 (高亮)”、“已通过”、“全部”的快速状态切换。
*   **右侧**：
    *   **时间范围**：下拉选择器，用于按时间过滤。
    *   **搜索框**：带有放大镜图标，用于搜索特定事件。
    *   **帮助图标**：点击可查看帮助文档（问号图标）。

### 3. 主内容列表区 (ListView)（滑动列表，无滚动条）
这里展示了具体的审批任务卡片。图中有两个卡片，展示了一收一放的状态：
*   **第一个卡片（折叠状态）**：只显示了头部（发起者、关联工单、时间）和一句简短的预览文本。右侧的 `>` 箭头表示可以点击展开。
*   **第二个卡片（展开状态）**：当前正在处理的详细任务。
    *   **CardHeader (卡片头部)**：显示发起人信息、关联工单信息以及创建时间。
    *   **CardBody (卡片主体)**：
        *   **题干说明**：解释了这是一个三选一的测试题，并说明了填写规则。
        *   **选项列表**：清晰列出了选项 A、B、C 及其对应的处理逻辑描述。
        *   **输入区**：一个文本输入框（带有编辑图标），让用户在这里“输入你的答案”。
        *   **附件区**：提示可以附加文件，并说明了点击可在右侧栏浏览（可选填）。
    *   **CardFooter (卡片底部/操作区)**：
        *   左下角是 `1/1` 的分页信息。
        *   右下角有两个核心操作按钮：“**跳过**”（次要按钮）和“**提交**”（主要按钮，通常会有高亮颜色以吸引点击）。