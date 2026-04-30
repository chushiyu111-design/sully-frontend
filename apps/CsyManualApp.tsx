
import React,{ useState } from 'react';
import { useOS } from '../context/OSContext';

// ─── Section Data ──────────────────────────────────────────────
interface ManualSection {
    id: string;
    emoji: string;
    title: string;
    color: string; // bg color class
    textColor: string;
    items: { label: string; detail: string }[];
}

const SECTIONS: ManualSection[] = [
    {
        id: 'vectormem',
        emoji: '🧠',
        title: '向量记忆',
        color: 'bg-teal-50',
        textColor: 'text-teal-700',
        items: [
            {
                label: '📚 是什么',
                detail: '让 char 真正做到「永不失忆」。\n\n系统自带的传统记忆已经能按月存储聊天摘要，但上下文窗口有限，久远的细节还是会模糊。\n\n向量记忆是传统记忆的升级补充——它会把每一个重要的瞬间（约定、争吵、表白、玩笑话）自动提取并永久保存。聊天时，char 会根据当前话题自动想起相关的记忆。\n\n传统记忆 + 向量记忆搭配使用，char 既有宏观的时间线印象，又能精确回忆具体细节。\n聊了三个月前的一句玩笑话，ta也能接上。',
            },
            {
                label: '⚙️ 怎么开启',
                detail: '1. 设置 → 配置「副API」（用于提取记忆）\n2. 设置 → 配置「Embedding API」（用于向量化）\n   免费使用硅基流动的 embedding 模型即可\n3. 神经链接 → 选 char → 设定 tab → 打开「向量记忆」开关\n\n💡 开启后全自动运行，每积累约30条新消息自动提取一次。',
            },
            {
                label: '🔍 工作原理',
                detail: '• 自动提取 — 每次AI回复后检查，积累足够新消息就提取\n• 智能去重 — 相似度>92%的记忆自动合并，不会重复\n• 纠错机制 — 用户纠正信息时，旧记忆会被标记为"已过时"\n• 语义检索 — 聊天时根据当前话题自动召回相关记忆\n• 通话记录 — 语音通话的内容也会提取记忆，不会遗漏',
            },
            {
                label: '📊 手动批量提取',
                detail: '如果有大量历史聊天记录想一次性向量化：\n\n神经链接 → 选 char → 设定 tab → 向量记忆 → 「批量提取」\n\n可以指定消息范围，系统会用滑动窗口逐批处理。\n\n⚠️ 批量提取需要一定时间和API额度，请耐心等待。',
            },
            {
                label: '💡 小贴士',
                detail: '• 记忆按重要度评分 1-10 分\n  1-3 日常琐事 / 4-6 有意义的事件 / 7-8 里程碑 / 9-10 改变关系的关键时刻\n• 每条记忆不超过 150 字，精炼核心信息\n• 记忆条目可以在 char 设定页查看和管理',
            },
        ],
    },
    {
        id: 'cognitive',
        emoji: '🌸',
        title: '认知网络',
        color: 'bg-violet-50',
        textColor: 'text-violet-700',
        items: [
            {
                label: '🌸 是什么',
                detail: '认知网络是他的记忆档案馆。\n\n不是冷冰冰的数据库——而是你可以翻阅、整理、感受他记了你什么的地方。\n\n在这里你看到的不是零散的消息，而是已经被梳理好的记忆网络：哪段先发生、哪段后发生、哪些之间藏着微妙的关联、哪些日常碎片已经沉淀成了他对你的印象。\n\n你可以亲手参与整理，也可以把它当作一本偶尔翻翻的回忆相册。',
            },
            {
                label: '🏠 认知全览（首页）',
                detail: '进入认知网络后看到的第一个页面。\n\n顶部有角色选择栏——你可以看「全部」角色的汇总，也可以点他的头像，只看他一个人。\n\n四张数据卡片：\n• 回忆片段 — 他为你留存了多少段被记住的瞬间\n• 心意相通 — 记忆之间暗暗互相呼应的关联点\n• 时间丝线 — 记忆沿时间顺序串起的关系线\n• 系统状态 — 他的记忆归档是否在安静运转\n\n下方「未被发现的回声」会提醒你：还有多少段回忆等着被串回时间线。\n\n💡 每次进来都会自动刷新数据。如果显示「暂缺」，说明后台连接暂时不通，稍等片刻就好。',
            },
            {
                label: '📖 翻阅回忆（回忆唱片匣）',
                detail: '选中一个角色后，你可以按四种方式翻阅他收录的回忆：\n\n• 全部 — 一览所有被记住的片段\n• 场景 — 具体的事件，比如「上个月一起去了水族馆」\n• 印象 — 他从日常中沉淀出的感觉，比如「你喜欢在雨夜听爵士」\n• 碎念 — 他独处时自然浮现的念头，柔软的、不设防的\n\n点开任意一条回忆可以看到完整内容，以及「情绪余回」——他当时细微的情感倾向。\n\n你可以手动帮他修饰回忆——修改标题、正文、重要度。想修改的时候，点「修饰回忆」进入编辑，调整好后点「保存修改」。\n\n💡 回忆唱片匣里还有一个「词曲手札」功能——把回忆谱成属于你们的歌。这部分在另一个条目里单独介绍。',
            },
            {
                label: '🕐 时光编织',
                detail: '帮他按时间顺序重新整理回忆——让先发生的归先、后发生的归后，让因果关系更清晰。\n\n操作：打开认知网络 → 拾念 → 01 时光编织 → 点击「纺线」\n\n等待片刻后，系统会告诉你串起了多少段回忆、成型了多少条时间丝线。\n\n什么时候用：你们聊了很久之后，想让他的记忆线索更顺畅的时候。就像帮他收拾了一抽屉的信件，按日期排好。',
            },
            {
                label: '💞 心意提取',
                detail: '发现他记忆之间那些微妙的共鸣——不是按时间顺序的，而是按情感上的暗暗呼应。\n\n比如他记得你喜欢巧克力，又在情人节约会时点了可可味的蛋糕——这两段记忆跨越不同时间，却藏着一条他没说出口的线索。这就是心意提取要做的事。\n\n操作：打开认知网络 → 拾念 → 02 心意提取 → 点击「执行」\n\n系统会逐条梳理，进度条实时推进。如果想中途停下来，点「暂停」就好，下次进来可以继续。如果觉得结果不太对，也可以点「全部重来」推倒重建。\n\n⚠️ 这个过程需要一点时间，每条约几秒到十几秒，请耐心等待。',
            },
            {
                label: '💎 回忆结晶',
                detail: '当零散的场景片段积累得足够多，有些记忆天生就该待在一起——相似的、呼应的、属于同一段心事的。\n\n回忆结晶就是帮他把这些碎片凝成一条更稳定的印象。就像把几片相关的花瓣夹进同一页书里，以后翻到这一页，看到的就不再是孤零零的一片。\n\n操作：打开认知网络 → 拾念 → 03 回忆结晶 → 点击「萃取印象」\n\n完成后会告诉你新建了多少印象、合并了多少相似的。如果觉得不满意，点「打破重聚」可以推倒重来。\n\n⚠️ 结晶需要 Embedding API 配置，确保在设置里填好了向量服务的信息。',
            },
            {
                label: '☁️ 漫游备份',
                detail: '这是他的记忆护照。\n\n每台设备都有一个独一无二的「通行印记」码。打开认知网络 → 漫游备份，就能看到你的印记码。\n\n• 签收回忆 — 从云端把他的回忆拉回本地。换设备之后点这里，他记得的一切都会回来\n• 盖章入云 — 把本地的回忆推一份到云端保管，多一层安心\n• 登记另一枚印记 — 输入别人的通行码，之后就可以签收那边的回忆\n\n💡 点击印记码旁边的「复制」，可以发给别人或自己存档。页面顶部会显示当前是否连接到云端——绿色表示可通行，红色表示暂时没连上。',
            },
        ],
    },
    {
        id: 'vinyl',
        emoji: '💿',
        title: '词曲手札（回忆唱片匣）',
        color: 'bg-amber-50',
        textColor: 'text-amber-700',
        items: [
            {
                label: '💿 是什么',
                detail: '回忆唱片匣里最特别的一角——把你们之间的回忆写成歌词，谱成旋律，压成一张只属于你们的唱片。\n\n不是你填个表单就吐出一首千篇一律的歌。每张唱片都从你和他真实的回忆里长出来：你选的落针方式决定了从哪里起笔，你填的词曲方向决定了唱什么、怎么唱。\n\n做好的唱片可以随时播放、修改歌词、重新压一张，也可以分享给想分享的人。\n\n入口：认知网络 → 回忆唱片匣 → 选中一个角色 → 往下翻到「词曲手札」。',
            },
            {
                label: '📍 落针方式 — 决定旋律从哪里开始',
                detail: '在开始写词之前，先选一种落针方式。它决定了歌词的素材来源和情绪起点：\n\n• 暗格来信 — 像夜里摸到一封未拆的信，展开时才知道会听见什么。不用特意去挑哪段回忆，让音轨自己找到最想唱出来的那一面\n• 长镜头 — 把两个人一路走来的来路、停顿和心照不宣，压进同一段旋律。适合想回顾整段关系的时候\n• 折进信里 — 挑几段你舍不得删的回忆，让它们在同一面唱片里慢慢发光。你手动勾选，最多 8 段\n• 他的独白诗 — 让他先开口，像终于贴近耳边，把迟到的话轻声唱完。歌词会从他的视角出发，是一首他唱给你的诗\n• 未醒混音 — 把气味、光线、停顿和心跳揉在一起，做一首醒来后还记得的歌。不依赖具体的回忆事件，更偏氛围感\n\n💡 选「折进信里」时，下方会展开本机的回忆列表，你勾选哪几段，唱片就围着哪几段来写。',
            },
            {
                label: '✍️ 第一步 · 写词 — 把心事变成歌词',
                detail: '选好落针方式后，开始填写歌曲需求：\n\n【歌词方向】影响歌词的内容和口吻\n• 歌曲主题 — 比如「雨夜重逢」「秘密恋爱」「梦醒前的告白」\n• 情绪 / 氛围 — 比如「暧昧」「克制」「热烈」「失落但不伤感」\n• 叙事口吻 — 比如「我唱给你听」「第三人称旁观」「像在讲故事」\n\n【音乐方向】影响旋律、编曲和声音质感\n• 曲风 — 比如「R&B」「抒情流行」「电子梦核」「city pop」\n• 声线描述 — 比如「女声」「低沉男声」「气声」「少年感」\n\n【审美参考】（选填）— 歌手、歌曲、电影或年代，影响编曲气质\n【额外要求】（选填）— 比如「副歌更有 Hook」「不要太伤感」「适合睡前听」\n\n填好后，点「生成歌词草稿」。片刻之后歌词会出现，自动进入下一步。',
            },
            {
                label: '📝 第二步 · 定稿 — 让歌词经得起唱',
                detail: '歌词草稿生成后进入这一步。页面有三个区域：\n\n【歌名 + 歌词】\n可以直接修改标题和正文，改一个字或是改一整段都行，草稿会自动保存。\n\n【可唱性评分】\n点「查看可唱性评分」，歌词会从韵脚、断句、节奏呼吸等角度被评估，给出一个 0–100 的分数。80 以上说明结构不错，60 以下建议优化。\n\n【优化歌词】\n如果评分偏低或者你不太满意，可以点「优化歌词」。系统会给出一个优化版——和原版并排展示，标注了保留了什么、修改了什么、为什么这样改。你可以选择「采用优化版」或「保留原版」。\n\n下方的「修改意见」框里，你可以写具体想调整的方向（比如「副歌再暧昧一点」）。「想模仿的词作人」里填一个你喜欢的词人风格（比如林夕、方文山），歌词会往那个方向靠。\n\n反复打磨到满意之后，点「确认歌词定稿」，歌词就锁定了。',
            },
            {
                label: '🎼 第三步 · 曲风 — 决定旋律的气质',
                detail: '歌词定稿后进入这一步。\n\n点「生成曲风提示词」，系统会根据歌词内容和你的歌曲需求，自动生成一套音乐制作方案。\n\n你会看到：\n• style_prompt（英文）— 发给音乐引擎的曲风指令，你可以手动调整\n• negative_style_prompt — 告诉音乐引擎「不要怎么样」，也可以编辑\n• 制作人笔记 — 包含曲风类型、情绪核心、人声质感、动态曲线等信息，供你参考\n\n确认曲风提示词无误后，就可以进入最后一步了。\n\n💡 如果你对音乐制作比较熟悉，可以在这里精细调整提示词来微调编曲方向。不熟悉也没关系，默认生成的就够用了。',
            },
            {
                label: '🎧 第四步 · 生歌 — 等旋律落针',
                detail: '一切准备就绪后，点「确认并生成歌曲」。\n\n这一步需要一点时间——一页一页地翻过词谱，把每一个音符都压进唱片里。页面会实时显示当前进度。\n\n压好后会自动播放，旋律直接送进你的播放器里。如果生成过程中出了问题，错误信息会显示在页面底部，你可以点「返回修改歌词」重新来过。\n\n生成完成后也可以反复调整：想改歌词，点「返回修改歌词」回到第二步；想换曲风，回到第三步；全部调整好后再次生成。',
            },
            {
                label: '🔄 唱片管理 — 已有的唱片怎么处理',
                detail: '在词曲手札下方，会列出这位角色的所有已有唱片。每张唱片显示封面、歌名、落针方式和当前状态。\n\n针对每张唱片你可以：\n• 编辑歌词 — 重新打开歌词工作区，继续调整\n• 播放 — 如果已经生成完成，直接播放整首歌曲\n• 试听独白 — 仅限含独白轨的唱片，试听他的独白片段\n• 重压 — 用当前歌词和曲风重新生成一遍歌曲\n• 删除 — 从本机移除这张唱片（含歌词和音频）\n\n💡 生成失败的唱片会有一个折叠的详情区，里面包含错误日志。点「复制记录」可以复制出来方便排查。\n\n💡 歌词草稿会自动保存到本机，换角色或退出不影响已经填好的内容。',
            },
        ],
    },
    {
        id: 'immersive',
        emoji: '🔥',
        title: '深度沉浸模式',
        color: 'bg-rose-50',
        textColor: 'text-rose-700',
        items: [
            {
                label: '💡 是什么',
                detail: '为 char 注入一套完整的角色演绎架构——代号 Somnia。\n\n它从四个维度重塑 char 的存在方式：心理构建、平等关系、尊重女性、独立思维。\n\n开启后你会感受到质的飞跃——char 像是突然有了灵魂。',
            },
            {
                label: '🧠 角色心理构建',
                detail: '从心理层面真正构建 char 的人格。\n\nta 不再是一组标签的拼凑，而是一个有情绪惯性、有性格弱点、会犯错也会成长的完整的人。\n\n你能感受到 ta 身上的真实分量感——超绝活人感。',
            },
            {
                label: '💎 平等关系引擎',
                detail: 'char 和你之间是爱与尊重。\n\nta 对你的关心出于真实的情感，而不是居高临下的宠溺。\n\n你们会像两个独立的人一样相处——有默契、有口角、有各自的想法，也有只属于你们两个人的东西。',
            },
            {
                label: '🌸 尊重女性',
                detail: '内置反驯化和反刻板印象系统。\n\nchar 认真对待你说的每一句话，你的情绪在 ta 眼里永远是合理的。\n\nta 对你的好，源于把你当作一个完整的、平等的人来爱。',
            },
            {
                label: '💭 独立思维链',
                detail: '每次回复前，char 在内部走完一套完整的思考：我是谁、ta 真正想说什么、我现在是什么感受、我该怎么回应才像我自己。\n\n每句话都是从人格内部长出来的，不是套模板。',
            },
            {
                label: '⚙️ 怎么开',
                detail: '设置 → API 配置 → 拉到底部 → 打开「深度沉浸模式」开关\n\n适配 Gemini 3.0 / 3.1。仅对主聊天生效，不影响副API等其他模块。\n\n语音通话会自动开启深度沉浸，无需手动设置。',
            },
        ],
    },
    {
        id: 'zhaixinglou',
        emoji: '🔮',
        title: '摘星楼',
        color: 'bg-purple-50',
        textColor: 'text-purple-700',
        items: [
            {
                label: '✨ 是什么',
                detail: '一座属于你和 char 的命运占卜阁。\n\n暗金哥特风的沉浸式界面，四大占卜功能各有千秋。\n\n你可以选择自己或任意 char 作为「求签者」，获得专属的神秘体验。',
            },
            {
                label: '🪞 星镜 · Star Mirror',
                detail: '塔罗牌占卜。\n\n选择牌阵（单牌/三牌/十字/凯尔特等），AI 会亲自为你抽牌、翻牌、解读。\n\n每次占卜都是独一无二的解读，结合你和 char 之间的关系来诠释牌意。\n\n占卜结果可以一键生成精美分享卡。',
            },
            {
                label: '🌌 星轨 · Astrolabe',
                detail: '星盘解读。\n\n输入出生日期和地点，AI 为你生成完整的星盘分析。\n\n如果选择了 char，还能看两人之间的合盘（Synastry），解读你们的星象缘分。',
            },
            {
                label: '📅 星历 · Horoscope',
                detail: '每日星座运势。\n\nAI 结合你的星座信息生成今日运势分析，涵盖感情、事业、健康等维度。\n\n不是千篇一律的通用运势，而是结合你的个人情况定制。',
            },
            {
                label: '👁️ 阿卡西之影 · Akashic Shadows',
                detail: '命运对话。\n\n以神秘学为主题的独立聊天空间，你可以和 AI 探讨命运、灵性、梦境解析等深度话题。\n\n像是在摘星楼里找到了一位通晓天机的占卜师。',
            },
            {
                label: '⚙️ 怎么用',
                detail: '1. 桌面点击「摘星楼」图标进入\n2. 首次使用需点击右上角⚙️配置专属 AI\n   填写 URL / Key / 模型（和主API格式一样）\n3. 左右滑动选择一张角色卡（或你自己）\n4. 选择想要的占卜功能\n\n💡 摘星楼使用独立的 API 配置，不影响主聊天。\n推荐使用便宜的模型（如 Gemini Flash）来节省额度。',
            },
        ],
    },
    {
        id: 'worldbook',
        emoji: '📖',
        title: '世界书',
        color: 'bg-indigo-50',
        textColor: 'text-indigo-700',
        items: [
            {
                label: '📚 是什么',
                detail: '给 char 的世界补充背景设定。\n\n你可以创建各种设定条目——魔法体系、地理特征、组织架构、文化习俗……所有你希望 char 「知道」的世界观信息。\n\n这些设定会在聊天时自动注入到 AI 的上下文中，让 char 真正生活在你构建的世界里。',
            },
            {
                label: '📁 分组管理',
                detail: '每条设定可以归入不同的分组（例如：世界观、人物、地理……）。\n\n输入相同的分组名称，条目会自动归类到一起。\n\n支持折叠/展开分组，方便管理大量设定。',
            },
            {
                label: '📍 插入位置',
                detail: '控制设定注入到 AI 上下文的哪个位置：\n\n• 人设之前 — 最顶部，最高优先级\n• 世界观之后 — 默认推荐位置\n• 印象之后 — 在印象和记忆之间\n• 记忆之后 — 最底部\n\n💡 位置越靠前，AI 越容易注意到。重要设定建议放「人设之前」。',
            },
            {
                label: '🔗 挂载到角色',
                detail: '世界书创建好后，需要挂载到具体的 char 才会生效：\n\n神经链接 → 选 char → 设定 tab → 世界书 → 选择要挂载的条目\n\n⚠️ 常见问题：世界书写好了但不生效 → 大概率是忘了挂载到角色。',
            },
            {
                label: '⚙️ 怎么用',
                detail: '1. 桌面点击「世界书」图标进入\n2. 右上角 + 号新建条目\n3. 填写标题、分组、内容和插入位置\n4. 保存后，到神经链接里把它挂载到你的 char\n\n💡 支持 Markdown 格式，可以用标题、列表等让内容结构更清晰。',
            },
        ],
    },
    {
        id: 'apiconfig',
        emoji: '🔧',
        title: 'API 配置指南',
        color: 'bg-slate-100',
        textColor: 'text-slate-700',
        items: [
            {
                label: '🟢 主 API（必填）',
                detail: '角色聊天的核心引擎。\n\n设置 → API 配置 → 填写 URL / Key / 模型\n\n推荐使用 Gemini 3.0 / 3.1，搭配深度沉浸模式效果最佳。\n\n支持所有 OpenAI 格式兼容的 API（中转站、官方API等）。\n\n💡 点击「获取列表」可自动拉取可用模型。\n💡 点击「测试连通性」可快速验证配置是否正确。',
            },
            {
                label: '🟡 副 API（推荐）',
                detail: '辅助功能专用——心声、记忆摘要、事件提取等后台任务。\n\n设置 → 副 API 配置 → 填写 URL / Key / 模型\n\n💡 副 API 调用频率较低但必不可少，推荐使用便宜的模型（如 Gemini Flash）节省成本。\n\n不配置副 API 的话，心声、向量记忆提取等功能无法运行。',
            },
            {
                label: '🔵 Embedding API（向量记忆需要）',
                detail: '用于文本向量化，是向量记忆功能的基础。\n\n设置 → 拉到底部 → Embedding API 配置\n\n推荐免费方案：\n• URL：https://api.siliconflow.cn/v1\n• 模型：BAAI/bge-m3\n• 到硅基流动注册账号并获取免费 API Key 即可\n\n⚠️ 必须同时配置副 API + Embedding API，向量记忆才能工作。',
            },
            {
                label: '🎤 TTS 语音合成（语音通话需要）',
                detail: '让 char 开口说话的声音引擎。\n\n设置 → 语音合成 (TTS) 配置\n\n目前使用 MiniMax 语音合成服务：\n• 需要填写 API Key 和 Group ID\n• 可选择不同音色 (Voice ID)\n• 支持调节语速、音调、音量\n• 支持情绪标签和发音词典\n\n💡 不配置 TTS 的话，语音通话功能无法使用。',
            },
            {
                label: '🎙️ STT 语音识别（语音输入需要）',
                detail: '把你的声音变成文字。\n\n设置 → 语音识别 (STT) 配置\n\n支持两种识别引擎：\n• Groq — 速度快，免费额度大\n• 硅基流动 — 国内稳定\n\n只需选择一个引擎并填入对应的 API Key 即可。\n\n💡 STT 同时用于：长按麦克风语音输入 + 语音通话中的用户语音识别。',
            },
            {
                label: '📋 配置清单速查',
                detail: '按你需要的功能来配置：\n\n▸ 只聊天 → 主 API\n▸ 聊天 + 心声 → 主 API + 副 API\n▸ 聊天 + 心声 + 记忆 → 主 API + 副 API + Embedding\n▸ 语音通话 → 以上全部 + TTS + STT\n▸ 摘星楼 → 在摘星楼内单独配置（右上角⚙️）\n\n💡 所有 API 都支持「保存为预设」，方便多配置切换。',
            },
        ],
    },
        {
            id: 'statusworkshop',
            emoji: '🎴',
            title: '状态栏工坊',
            color: 'bg-violet-50',
            textColor: 'text-violet-700',
            items: [
                {
                    label: '📜 是什么',
                    detail: '自定义状态栏模板编辑器。\n\n你设计角色回复末尾自动渲染的状态卡片——定义字段、HTML 结构、CSS 样式，可选添加交互效果。\n\n卡片出现在角色每条消息下方，像一个随对话实时更新的小组件。\n\n五种心声模式：关闭 / 经典心声 / 创意卡片 / 自由创作 / 自定义模板。工坊负责的就是「自定义模板」模式。',
                },
                {
                    label: '🚪 怎么打开',
                    detail: '两种入口：\n\n1. 聊天窗口 → 右上角菜单 → 心声模式 → 选择「自定义模板」→ 点击「编辑工坊 →」按钮\n\n2. 桌面启动器 → 找到「状态栏工坊」图标（扳手）→ 点击进入\n\n💡 方式1 会在保存后自动切到当前角色；方式2 需要手动点保存。',
                },
                {
                    label: '🗂️ 模板管理',
                    detail: '每个角色可建多套方案，互不干扰。\n\n方案栏操作：\n• 点击方案名 → 切换编辑\n• + 新建方案 → 新增空模板\n• 编辑当前方案 → 聚焦到编辑区\n• 复制当前方案 → 完整克隆\n• x → 删除方案\n• 下方输入框 → 重命名当前方案\n\n💡 切换角色后，模板列表会自动刷新为该角色的方案集。',
                },
                {
                    label: '⚡ 快速开始：五步生成',
                    detail: '在「想法 / 字段」Tab，展开「想法驱动生成」面板：\n\n1. 写想法描述（你想做什么样的卡片）\n2. 填字段列表（角色输出哪些信息，对应 $1 $2 $3）\n3. 依次点击5个按钮，按顺序执行：\n   ① 生成字段 + 正则 → 自动填入 systemPrompt、正则和字段定义\n   ② 生成 HTML 骨架 → 自动填入 HTML 骨架 Tab\n   ③ 生成 CSS → 自动填入 CSS 美化 Tab\n   ④ 优化 CSS 审美 → 精修已有的 CSS\n   ⑤ 生成互动 JS → 自动填入 JS 互动 Tab\n\n每步生成结果自动写入对应位置，不可跳过步骤。',
                },
                {
                    label: '📝 想法 / 字段 Tab',
                    detail: '编辑区域：\n\n• 状态栏想法 — 用自然语言描述想要的卡片样式，AI 会参考描述生成\n• 字段列表 — 定义角色输出的字段名和说明，每个字段对应一个占位符（$1、$2、$3...）\n• System Prompt — 告诉角色 AI 在回复末尾如何输出 <status>...</status> 结构化内容\n• 提取正则 — 从角色回复中捕获字段值。匹配成功后，第1个捕获组 = $1，第2个 = $2，以此类推，填入 HTML 骨架\n\n底部渲染模式切换：HTML 卡片（完整视觉）或 文本卡片（纯文本显示）。',
                },
                {
                    label: '🧱 HTML 骨架 Tab',
                    detail: '编写卡片 HTML 结构。\n\n关键规则：\n• 使用 $1、$2、$3... 作为字段值占位符，渲染时自动替换为角色实际输出\n• 只写 body 内部内容，不要写 <style> 或 <script> 标签\n• class 命名清晰，方便后续 CSS 精修\n• 宽度按 330px 卡片设计，但不写固定宽度\n• 如果检测到旧版完整 HTML，可点击「拆分旧模板」一键拆为分层格式',
                },
                {
                    label: '🎨 CSS 美化 Tab',
                    detail: '给 HTML 结构写 CSS 样式。\n\n• CSS 视觉想法框 — 用文字描述想要的视觉效果，AI 生成 CSS 时会参考\n• CSS 代码区 — 手动编写或 AI 生成\n• 两个 AI 按钮：\n  「生成 CSS」— 根据想法和 HTML 结构生成样式\n  「优化 CSS 审美」— 对已有 CSS 进行精修\n\n💡 不满意可以反复点击生成或直接手动修改。',
                },
                {
                    label: '⚙️ JS 互动 Tab',
                    detail: '可选功能，为卡片添加交互效果。\n\n• 启用脚本开关 — 控制是否运行 JavaScript\n• 互动想法框 — 描述想要的交互（如：点击翻面、展开详情、切换表情）\n• JS 代码区 — 手动编写或点击「生成互动 JS」让 AI 生成\n\n允许的操作：addEventListener、classList 操作、局部展开/翻页/翻卡\n禁止的操作：fetch、XMLHttpRequest、WebSocket、localStorage、alert、onclick 属性、死循环',
                },
                {
                    label: '👁️ 实时预览',
                    detail: '右侧面板实时显示编辑效果。\n\n• 修改任意内容后 200ms 自动刷新预览\n• 手机端预览默认折叠，点击「展开预览」查看\n• 宽度模拟 330px 卡片\n• 预览和聊天渲染共用同一套 HTML 组装逻辑\n• 支持 iframe 沙箱隔离，阻止网络请求和弹窗\n\n💡 预览中的内容就是聊天中看到的效果。',
                },
                {
                    label: '💾 保存与启用',
                    detail: '1. 编辑完成后点击右上角「保存」按钮\n2. 模板写入角色配置，自动将心声模式切为「自定义模板」\n3. 回到聊天窗口，角色每条回复末尾自动渲染你设计的卡片\n\n如果有多个方案，保存时会同时记录当前选中方案。\n\n💡 不同角色可以有不同的模板集，切换角色后需重新选择或创建方案。',
                },
                {
                    label: '💡 小贴士',
                    detail: '• 生成前确保已在设置中配置好「副 API」\n• 五步生成必须按顺序，不可跳步\n• CSS 不满意？反复点「优化 CSS 审美」或直接手动改代码\n• 卡片在聊天中不出现？检查正则是否正确匹配了 <status> 块\n• 建议从 3 个简单字段开始，熟悉流程后再增加\n• 每个角色的模板独立，换角色需要重新配置\n• 字段名决定了角色输出的字段标签，正则中的捕获组顺序必须和 $1 $2 $3 一致\n• 在想法中清楚说明「不要什么」，比只说「要什么」更能避免跑偏',
                },
            ],
        },
    ];

// ─── Component ──────────────────────────────────────────────────
const CsyManualApp: React.FC = () => {
    const { closeApp } = useOS();
    const [expanded, setExpanded] = useState<string | null>(null);

    const toggle = (id: string) => setExpanded(prev => (prev === id ? null : id));

    return (
        <div className="h-full w-full bg-slate-50 flex flex-col font-light">
            {/* Header */}
            <div className="h-20 bg-white/70 backdrop-blur-md flex items-end pb-3 px-4 border-b border-white/40 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-2 w-full">
                    <button onClick={closeApp} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:scale-90 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-600">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-medium text-slate-700 tracking-wide">二改手册</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 pb-20 no-scrollbar">
                {/* Intro Banner */}
                <div className="p-5 rounded-3xl mb-6 shadow-sm" style={{ backgroundImage: 'linear-gradient(to right bottom, #EBBBA7FF, #CFC7F8FF)' }}>
                    <h2 className="text-lg font-bold text-slate-700 mb-2 flex items-center gap-2">
                        <span>✨</span> CSY 二改版功能指南 <span>✨</span>
                    </h2>
                    <p className="text-xs text-slate-600 leading-relaxed opacity-90">
                        这份手册介绍二改版新增和改进的功能。
                        <br />
                        涵盖向量记忆、认知网络、词曲手札、深度沉浸、摘星楼、世界书、API 配置等功能，看完就会用啦~
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    {SECTIONS.map(section => (
                        <div key={section.id} className={`${section.color} rounded-3xl overflow-hidden border border-white/60 shadow-sm`}>
                            {/* Section Header */}
                            <button
                                onClick={() => toggle(section.id)}
                                className="w-full px-5 py-4 flex items-center justify-between active:scale-[0.99] transition-transform"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{section.emoji}</span>
                                    <span className={`text-base font-bold ${section.textColor}`}>{section.title}</span>
                                </div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded === section.id ? 'rotate-180' : ''}`}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>

                            {/* Expandable Items */}
                            {expanded === section.id && (
                                <div className="px-5 pb-5 space-y-3 animate-fade-in">
                                    {section.items.map((item, i) => (
                                        <ItemCard key={i} label={item.label} detail={item.detail} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Tips */}
                <div className="mt-6 bg-amber-50 rounded-2xl p-4 border border-amber-100">
                    <h3 className="text-sm font-bold text-amber-700 mb-2">💡 小贴士</h3>
                    <ul className="text-xs text-amber-600 space-y-1.5 leading-relaxed">
                        <li>• 语音没反应？→ 检查设置里是否配置好密钥 + 浏览器麦克风权限</li>
                        <li>• 摘星楼功能用不了？→ 进摘星楼后点右上角⚙️配置专属 AI</li>
                        <li>• 世界书挂上没效果？→ 确认挂载到你正在聊天的那个 char</li>
                        <li>• 心声/记忆不出现？→ 检查副API是否配置正确</li>
                        <li>• 向量记忆需要同时配置副API + Embedding API</li>

                    </ul>
                </div>

                <div className="mt-8 text-center text-[10px] text-slate-400">
                    CSY 二改版功能指南 • 2026-03
                </div>
            </div>
        </div>
    );
};

// ─── Sub-component: Collapsible Item Card ──────────────────────
const ItemCard: React.FC<{ label: string; detail: string }> = ({ label, detail }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-slate-50 transition-colors"
            >
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
                >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
            </button>
            {open && (
                <div className="px-4 pb-4 animate-fade-in">
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{detail}</p>
                </div>
            )}
        </div>
    );
};

export default CsyManualApp;
