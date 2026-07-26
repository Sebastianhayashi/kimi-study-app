(function initLucubroI18n(root) {
  'use strict';

  const LOCALES = ['en', 'zh-CN', 'ja'];
  const STORAGE_KEY = 'lucubro-locale';
  const phraseEntries = [
    ['Skip to main content', '跳到主要内容', 'メインコンテンツへ移動'],
    ['How it works', '如何工作', '使い方'],
    ['Learning workspace', '课程工作区', '学習ワークスペース'],
    ['My courses', '我的课程', 'マイコース'],
    ['Create a course', '创建课程', 'コースを作成'],
    ['Turn one book', '把一本书，', '一冊の本を'],
    ['into a course', '变成一门课。', '学べるコースへ'],
    ['Upload an EPUB, PDF, or text file and choose what you want to accomplish. Lucubro builds the lessons, practice, and review around that goal.', '上传 EPUB、PDF 或文本，选定你要解决的问题。Lucubro 会安排课节、练习和复习。', 'EPUB、PDF、テキストをアップロードし、達成したいことを選びます。Lucubro がその目標に合わせてレッスン、練習、復習を組み立てます。'],
    ['Start with my material', '用我的材料开始', '自分の教材ではじめる'],
    ['View my courses', '查看我的课程', 'コースを見る'],
    ['Upload', '上传', 'アップロード'],
    ['EPUB, PDF, and text', 'EPUB、PDF 与文本', 'EPUB、PDF、テキスト'],
    ['Set a goal', '设定', '目標を設定'],
    ['Choose an outcome and use case', '选择目标与使用场景', '成果と利用場面を選ぶ'],
    ['Study', '学习', '学ぶ'],
    ['Lessons, practice, and review history', '课节、练习与复习记录', 'レッスン、練習、復習履歴'],
    ['01 · From material to mastery', '01 · 从材料到掌握', '01 · 教材から習得まで'],
    ['Upload material, choose a goal,', '上传材料，选定目标，', '教材を追加して目標を選び、'],
    ['then start the first lesson.', '然后开始第一课。', '最初のレッスンを始めます。'],
    ['Choose material', '选择材料', '教材を選ぶ'],
    ['Upload an EPUB, PDF, Markdown file, or plain text. Lucubro checks the file and chapter structure first.', '上传 EPUB、PDF、Markdown 或纯文本。Lucubro 会先检查文件和章节结构。', 'EPUB、PDF、Markdown、テキストをアップロードします。Lucubro が先にファイルと章構成を確認します。'],
    ['Define the outcome', '明确目标', '成果を決める'],
    ['Choose where you plan to use the material. Lucubro uses that choice to shape examples and practice.', '选择你准备使用这份材料的场景。课程会据此安排案例与练习。', '教材をどこで使いたいか選びます。その選択に合わせて例と練習を構成します。'],
    ['Start the course', '开始课程', 'コースを始める'],
    ['Read the lesson, complete the practice, and ask questions with the current source attached.', '阅读课节、完成练习；有疑问时直接引用当前材料提问。', 'レッスンを読み、練習に取り組み、現在の教材を参照しながら質問できます。'],
    ['02 · Learning workspace', '02 · 学习工作区', '02 · 学習ワークスペース'],
    ['Lessons, notes, and questions stay on one page.', '课程、笔记和提问在同一个页面。', 'レッスン、ノート、質問を一つの画面に。'],
    ['Goals and the course outline stay on the left, the current lesson stays in the center, and Lucubro Assistant answers from the lesson and source on the right.', '左侧查看学习目标和目录，中间阅读当前课节，右侧的 Lucubro 助手会引用课节与原始材料回答。', '左に目標と目次、中央に現在のレッスン、右にレッスンと原文を参照して答える Lucubro アシスタントを配置します。'],
    ['Open course library', '进入课程库', 'コースライブラリを開く'],
    ['03 · Evidence of learning', '03 · 学会的证据', '03 · 学習の証拠'],
    ['Every lesson asks you to do something with what you learned.', '每节课都要回答问题。', '各レッスンで、学んだことを実際に使います。'],
    ['Practice checks whether you can explain an idea, judge a case, and apply it in a new situation. The result stays in your course progress.', '练习会检查你能否解释概念、判断案例并用到新场景。结果保存在课程进度里。', '概念を説明し、事例を判断し、新しい状況に応用できるかを練習で確かめます。結果はコース進捗に保存されます。'],
    ['Understand the source', '理解材料', '教材を理解'],
    ['Complete practice', '完成练习', '練習を完了'],
    ['Build evidence of mastery', '形成掌握证据', '習得の証拠を残す'],
    ['One source, a path shaped to your goal', '同一材料，不同路径', '同じ教材でも、目標に合う道筋'],
    ['The course emphasis follows your goal and starting point instead of sending everyone through the same outline.', '课程重点由目标和基础决定，不把所有人送进同一套章节目录。', '全員を同じ目次に通すのではなく、目標と現在地に合わせて重点を変えます。'],
    ['Questions include the current lesson', '提问会带上当前课节', '質問に現在のレッスンを添付'],
    ['Lucubro Assistant answers from the current lesson and original source first, and keeps answers available for review.', 'Lucubro 助手优先引用当前课节和原始材料，并保留可回看的回答。', 'Lucubro アシスタントは現在のレッスンと原文を優先して回答し、あとから見返せるように残します。'],
    ['04 · Your course library', '04 · 你的课程库', '04 · コースライブラリ'],
    ['Come back and continue the lesson you left.', '下次打开，接着上次的课节。', '次に開いたとき、前回の続きから。'],
    ['The library shows your current lesson, creation status, and recent study time. Start another course whenever you have new material.', '课程库会显示当前课节、创建状态和最近学习时间，也可以从另一份材料新建课程。', 'ライブラリには現在のレッスン、作成状況、最近の学習時間が表示されます。別の教材から新しいコースも作れます。'],
    ['Open library', '打开课程库', 'ライブラリを開く'],
    ['New course', '新建课程', '新しいコース'],
    ['Choose something you genuinely want to learn from.', '选一份你准备认真读的材料。', '本気で学びたい教材を一つ選びましょう。'],
    ['Create my first course', '创建第一门课程', '最初のコースを作る'],
    ['Upload material and start learning toward a clear outcome.', '上传材料，按目标开始学习。', '教材を追加し、明確な成果に向けて学び始めます。'],
    ['Product', '产品原理', 'プロダクト'],
    ['Privacy', '隐私说明', 'プライバシー'],
    ['All', '全部', 'すべて'],
    ['Learning', '学习中', '学習中'],
    ['Completed', '已完成', '完了'],
    ['Continue learning', '继续学习', '学習を続ける'],
    ['Continue where you left off', '继续上次学习', '前回の続きから'],
    ['Recent courses', '最近课程', '最近のコース'],
    ['Show all', '全部显示', 'すべて表示'],
    ['Continue', '继续', '続ける'],
    ['Retry available', '可重试', '再試行できます'],
    ['Ready to learn', '可学习', '学習できます'],
    ['Creating', '生成中', '作成中'],
    ['Upload learning material', '上传学习材料', '学習教材をアップロード'],
    ['Upload an EPUB, PDF, Markdown file, or TXT. After the file check, choose what this course should help you accomplish.', '支持 EPUB、PDF、Markdown 和 TXT。文件检查完成后，再设置这门课的学习重点。', 'EPUB、PDF、Markdown、TXT に対応しています。ファイル確認後、このコースで達成したいことを選びます。'],
    ['Choose a file or drop it here', '选择文件或拖到这里', 'ファイルを選ぶか、ここにドロップ'],
    ['Lucubro checks the file after you continue', '选择后可以检查文件', '続けるとファイルを確認します'],
    ['EPUB, PDF, Markdown, or plain text', 'EPUB、PDF、Markdown 或纯文本', 'EPUB、PDF、Markdown、テキスト'],
    ['Back to library', '返回课程库', 'ライブラリに戻る'],
    ['Reading your material', '正在读取你的材料', '教材を読み込んでいます'],
    ['Lucubro checks the structure before asking the questions needed to shape your course.', '先确认内容结构，再问你几个必要的问题。', '内容構成を確認してから、コース設計に必要な質問をします。'],
    ['Set your learning goal', '设定学习目标', '学習目標を設定'],
    ['Choose the use case closest to yours. Lucubro uses it to shape examples and practice.', '选择最接近的使用场景。Lucubro 会据此安排案例和练习。', '最も近い利用場面を選んでください。Lucubro が例と練習に反映します。'],
    ['Learning material · Goal', '学习材料 · 学习目标', '学習教材 · 目標'],
    ['Preparing a question', '正在准备问题', '質問を準備しています'],
    ['The file check is complete. Lucubro is using the table of contents and chapter summaries to prepare useful goal options.', '文件检查完成。Lucubro 正在根据目录和章节摘要整理可选的学习目标。', 'ファイル確認が完了しました。Lucubro が目次と章の要約から、役立つ目標候補を準備しています。'],
    ['Optional details', '补充说明（可选）', '補足（任意）'],
    ['Creating your first lesson', '正在创建第一课', '最初のレッスンを作成中'],
    ['Your material is saved. The first lesson opens automatically after it passes validation.', '材料已保留。第一课通过检查后会自动打开。', '教材は保存されています。最初のレッスンは検証完了後に自動で開きます。'],
    ['Course creation progress', '课程生成进度', 'コース作成の進捗'],
    ['View processing steps', '查看处理步骤', '処理ステップを見る'],
    ['Course ready', '课程已准备好', 'コースの準備ができました'],
    ['Start the first lesson', '开始第一课', '最初のレッスンを始める'],
    ['Learning context', '学习上下文', '学習コンテキスト'],
    ['Overview', '学习概览', '概要'],
    ['Learning map', '学习地图', '学習マップ'],
    ['Course outline', '课程目录', 'コース目次'],
    ['Note', '笔记', 'ノート'],
    ['Notes', '笔记', 'ノート'],
    ['Learning goal', '学习目标', '学習目標'],
    ['Your course is organized around the material and learning goal you chose. Continue from the current lesson.', '课程已按你上传的材料和学习目标排好。可以从当前课节继续。', 'アップロードした教材と選んだ目標に沿ってコースを構成しました。現在のレッスンから続けられます。'],
    ['Goal confirmed', '目标已明确', '目標を確認済み'],
    ['View success criteria and scope', '查看成功标准与范围', '成功条件と範囲を見る'],
    ['Course progress', '课程进度', 'コース進捗'],
    ['Learning record', '学习记录', '学習記録'],
    ['Today', '今天', '今日'],
    ['Course created', '课程已创建', 'コースを作成しました'],
    ['Original', '原文', '原文'],
    ['Next lesson', '下一课', '次のレッスン'],
    ['Assistant', '助手', 'アシスタント'],
    ['Lucubro Assistant', 'Lucubro 助手', 'Lucubro アシスタント'],
    ['Grounded in this course', '基于当前课程', 'このコースに基づく'],
    ['New chat', '新对话', '新しい会話'],
    ['I have the current lesson and its source material. Ask for an explanation, an example, feedback on an answer, or an action exercise.', '我已经读取当前课节和对应材料。你可以让我解释概念、举例、检查答案，或把本课内容转换成行动练习。', '現在のレッスンと対応する教材を参照できます。説明、例、回答へのフィードバック、行動練習を依頼してください。'],
    ['Core idea', '核心论点', '中心となる考え'],
    ['Lesson practice', '课后练习', 'レッスン練習'],
    ['Explain this lesson simply', '用中文解释本课', 'このレッスンをやさしく説明'],
    ['Summarize three key ideas', '总结三个核心观点', '重要な点を3つに要約'],
    ['Give me a work example', '举一个工作场景的例子', '仕事での例を挙げる'],
    ['Check my understanding', '检查我的理解', '理解を確認'],
    ['Answers prioritize this course and its source material', '优先引用当前课程和原材料', 'このコースと原資料を優先して回答'],
    ['Course creation did not finish', '课程创建未完成', 'コース作成が完了しませんでした'],
    ['Stopped', '已停止', '停止しました'],
    ['Material uploaded', '材料已经上传', '教材をアップロード済み'],
    ['Your material is saved. Return to the library to try creating the course again.', '材料已保留，可以返回课程库后重新创建', '教材は保存されています。ライブラリに戻ってコース作成を再試行できます。'],
    ['Course generation was interrupted. Try again.', '课程生成已中断，请重试', 'コース作成が中断されました。再試行してください。'],
    ['Try again', '返回并重试', '再試行する'],
    ['Read source material', '读取教材内容', '教材を読み込む'],
    ['Course generation did not finish', '课程生成没有完成', 'コース作成が完了しませんでした'],
    ['Generation has stopped. Return to the library to create the course again.', '生成过程已经停止。返回课程库后可以重新创建课程。', '作成処理は停止しました。ライブラリに戻って、もう一度コースを作成できます。'],
    ['Backend task', '后端任务', 'バックエンド処理'],
    ['View generation details', '查看生成过程', '作成の詳細を見る'],
    ['Verifiable generation record', '可验证的生成过程', '確認できる作成履歴'],
    ['This view records completed stages and course files. It does not display private model reasoning.', '这里记录已完成的处理阶段和课程文件，不展示内部推理过程。', '完了した段階とコースファイルを記録します。モデルの内部推論は表示しません。'],
    ['Live activity', '实时执行记录', 'リアルタイムの処理履歴'],
    ['Waiting', '等待', '待機中'],
    ['In progress', '进行中', '進行中'],
    ['Not confirmed by the service yet', '尚未收到后端确认', 'サービスの確認待ち'],
    ['Course generation failed. Try again.', '课程创建没有完成，请重试', 'コース作成に失敗しました。再試行してください。'],
    ['Course creation failed. Your material and confirmed learning settings are still saved.', '课程创建没有完成，请重试。材料和已确认的学习设置仍然保留。', 'コース作成に失敗しました。教材と確認済みの学習設定は保存されています。'],
    ['No notes yet. Select text in the lesson to add a note, or save a Lucubro answer here.', '还没有笔记。划选课文后可以记笔记，Lucubro 的回答也可以保存到这里。', 'ノートはまだありません。レッスンの文章を選択してメモするか、Lucubro の回答を保存できます。'],
    ['Ask Lucubro about this lesson…', '就当前课节向 Lucubro 提问…', 'このレッスンについて Lucubro に質問…'],
    ['Back', '返回', '戻る'],
    ['Close', '关闭', '閉じる'],
    ['Retry', '重试', '再試行'],
    ['Save', '保存', '保存'],
    ['Cancel', '取消', 'キャンセル'],
    ['Search courses', '搜索课程', 'コースを検索'],
    ['Newest first', '新的在前', '新しい順'],
    ['Skip to notes', '跳到笔记', 'ノートへ移動'],
    ['Your learning record', '你的学习记录', '学習記録'],
    ['Notes from every course, in one place.', '所有课程的笔记，都在这里。', 'すべてのコースのノートを一か所に。'],
    ['Review what you highlighted, wrote, and asked Lucubro—then return to the exact lesson and source context.', '集中回看划线、笔记和向 Lucubro 提过的问题，并随时回到对应课节和原文位置。', 'ハイライト、ノート、Lucubro への質問をまとめて振り返り、元のレッスンと原文へ戻れます。'],
    ['saved notes', '条已保存笔记', '保存済みノート'],
    ['Study rhythm', '学习节奏', '学習リズム'],
    ['Your learning activity', '你的学习活动', '学習アクティビティ'],
    ['Your recent lessons, notes, and practice will appear here.', '最近打开的课节、笔记和练习会记录在这里。', '最近のレッスン、ノート、練習がここに記録されます。'],
    ['Select a day to see its activity.', '选择一天查看当天的学习记录。', '日付を選ぶと、その日の学習記録を確認できます。'],
    ['Less', '少', '少'],
    ['More', '多', '多'],
    ['Notebook', '笔记本', 'ノートブック'],
    ['Everything you kept', '所有留下的内容', '残したものすべて'],
    ['Search notes', '搜索笔记', 'ノートを検索'],
    ['Course', '课程', 'コース'],
    ['Lessons', '课节', 'レッスン'],
    ['Goal', '目标', '目標'],
    ['Plan', '路径', '学習計画'],
    ['Learning materials', '学习材料', '学習教材'],
    ['Mission', '任务', 'ミッション'],
    ['Resources', '资源', 'リソース'],
    ['More study options', '更多学习选项', 'その他の学習オプション'],
    ['Focus reading', '专注阅读', '集中して読む'],
    ['Full screen course', '全屏课程', 'コースを全画面表示'],
    ['Original material', '原始材料', '原資料'],
    ['Table of contents', '目录', '目次'],
    ['Light', '明亮', 'ライト'],
    ['Sepia', '护眼', 'セピア'],
    ['Dark', '深色', 'ダーク'],
    ['Opening learning material…', '正在打开学习资源…', '学習教材を開いています…'],
    ['This file cannot be opened here right now', '暂时无法在这里打开这个文件', '現在このファイルをここで開けません'],
    ['Open original file in a new window', '在新窗口打开原文件', '元のファイルを新しいウィンドウで開く'],
    ['Study draft', '学习草稿', '学習メモ'],
    ['Keep note', '记下', 'メモする'],
    ['Open notes', '打开笔记', 'ノートを開く'],
    ['Close notes', '关闭笔记', 'ノートを閉じる'],
    ['All courses', '全部课程', 'すべてのコース'],
    ['Type', '类型', '種類'],
    ['All notes', '全部笔记', 'すべてのノート'],
    ['My notes', '我的笔记', '自分のノート'],
    ['Lucubro answers', 'Lucubro 回答', 'Lucubro の回答'],
    ['Scratch notes', '草稿笔记', '下書きノート'],
    ['Clear filters', '清除筛选', '絞り込みを解除'],
    ['No notes yet', '还没有笔记', 'ノートはまだありません'],
    ['Select a passage in any lesson to save a highlight, write a note, or keep a Lucubro answer.', '在任意课节划选一段内容，就能保存高亮、写下笔记或保留 Lucubro 的回答。', 'レッスンの文章を選択して、ハイライト、ノート、Lucubro の回答を保存できます。'],
    ['Open a course', '打开课程', 'コースを開く'],
    ['Open in lesson', '回到课节', 'レッスンで開く'],
    ['Open all notes', '打开全部笔记', 'すべてのノートを開く'],
    ['This lesson', '当前课节', 'このレッスン'],
    ['All types', '全部类型', 'すべての種類'],
    ['Split view', '分屏阅读', '分割表示'],
    ['Read lesson and source side by side', '并排阅读课节与原文', 'レッスンと原文を並べて読む'],
    ['Continue where you left off', '继续上次学习', '前回の続きから'],
    ['Current lesson', '当前课节', '現在のレッスン'],
    ['View notes', '查看笔记', 'ノートを見る'],
    ['Open source', '打开原文', '原文を開く'],
    ['What are you working toward?', '你准备用这门课完成什么？', 'このコースで何に取り組みますか？'],
    ['Prepare and improve', '备考与提升', '学習と試験対策'],
    ['Use textbooks, past papers, and exercises. Your work helps shape what comes next.', '使用教材、试卷和练习题。你实际完成的作答会影响后续学习内容。', '教材、過去問、練習問題を使います。実際の回答が次の学習内容に反映されます。'],
    ['Solve a real problem', '解决现实问题', '現実の課題を解決'],
    ['Use books and articles to improve writing, communication, work, or a current project.', '用书籍和文章改善写作、表达、工作或手头的项目。', '本や記事を使って、文章、コミュニケーション、仕事、現在のプロジェクトを改善します。'],
    ['Lucubro goal selection built from Made to Stick', 'Lucubro 根据《让创意更有黏性》生成的学习目标选择页', '『アイデアのちから』から作成した Lucubro の目標選択画面'],
    ['Lucubro course workspace built from Made to Stick', '《让创意更有黏性》的 Lucubro 三栏课程工作区', '『アイデアのちから』から作成した Lucubro コースワークスペース'],
    ['Lucubro course library with real uploaded materials', '包含真实上传材料的 Lucubro 课程库', '実際にアップロードした教材を含む Lucubro コースライブラリ'],
    ['Lucubro home', 'Lucubro 首页', 'Lucubro ホーム'],
    ['Primary navigation', '主要导航', 'メインナビゲーション'],
    ['Usage steps', '使用步骤', '利用ステップ'],
    ['Footer navigation', '页脚导航', 'フッターナビゲーション'],
    ['Made to Stick goal selection', '《让创意更有黏性》学习目标', '『アイデアのちから』の学習目標'],
    ['Course materials are only used in the current learning workspace.', '课程材料仅用于当前学习工作区。', '教材は現在の学習ワークスペース内でのみ使用されます。'],
    ['Lucubro · Personal learning courses', 'Lucubro · 个人学习课程', 'Lucubro · 個人学習コース'],
    ['Notes · Lucubro', '笔记 · Lucubro', 'ノート · Lucubro'],
    ['Primary pages', '主要页面', 'メインページ'],
    ['Settings', '设置', '設定'],
    ['Apps', '应用', 'アプリ'],
    ['Account', '账户', 'アカウント'],
    ['Course navigation and tools', '课程导航和工具', 'コースナビゲーションとツール'],
    ['Course filters', '课程筛选', 'コースの絞り込み'],
    ['Oldest first', '旧的在前', '古い順'],
    ['By name', '按名称', '名前順'],
    ['View options', '视图切换', '表示切替'],
    ['Grid view', '网格视图', 'グリッド表示'],
    ['List view', '列表视图', 'リスト表示'],
    ['Sort', '排序', '並び替え'],
    ['Generated cover', '系统生成封面', '自動生成カバー'],
    ['More actions', '更多操作', 'その他の操作'],
    ['No courses match', '没有符合条件的课程', '条件に合うコースがありません'],
    ['Adjust the filters or create a new course.', '调整筛选条件，或者创建一门新课程。', '絞り込み条件を変えるか、新しいコースを作成してください。'],
    ['Archive', '归档', 'アーカイブ'],
    ['Delete', '删除', '削除'],
    ['Pending setup', '待设置', '設定待ち'],
    ['Curated textbooks', '预拆教材', '準備済み教科書'],
    ['Textbook library', '教材库', '教科書ライブラリ'],
    ['Find the textbooks schools are using by stage, grade, and edition. Each book is already fully parsed, so you can go straight to confirming your learning goal.', '按学段、年级和版本找到学校正在使用的教材。教材已经完成深度解析，选择后直接进入学习目标确认。', '学段・学年・版から学校で使われている教科書を探せます。教科書はすでに解析済みで、選ぶとそのまま学習目標の確認に進めます。'],
    ['Education stage', '教育阶段', '教育段階'],
    ['Elementary', '小学', '小学'],
    ['Middle school', '初中', '中学'],
    ['High school', '高中', '高校'],
    ['University', '大学', '大学'],
    ['Search textbooks, grades, subjects, or publishers', '搜索教材、年级、学科或出版社', '教科書・学年・科目・出版社を検索'],
    ['Common textbooks', '常用教材', 'よく使う教科書'],
    ['Currently shown as a product prototype', '当前展示为产品原型', '現在はプロトタイプとして表示'],
    ['View textbook', '查看教材', '教科書を見る'],
    ['Elementary · PEP, Book 1', '小学 · 人教版，上册', '小学 · 人教版、上巻'],
    ['Elementary · FLTRP, Book 1', '小学 · 外研版，上册', '小学 · 外研版、上巻'],
    ['Elementary · EEP, Book 1', '小学 · 教科版，上册', '小学 · 教科版、上巻'],
    ['Browse by subject', '按学科浏览', '科目から探す'],
    ['Pick a stage first, then narrow by grade and edition', '先选择学段，再进一步筛选年级和版本', 'まず学段を選び、学年と版で絞り込みます'],
    ['Chinese', '语文', '国語'],
    ['Math', '数学', '数学'],
    ['English', '英语', '英語'],
    ['Science', '科学', '理科'],
    ['History', '历史', '歴史'],
    ['Math · Grade 3', '数学 · 三年级', '数学 · 3年'],
    ['Chinese · Grade 5', '语文 · 五年级', '国語 · 5年'],
    ['English · Grade 4', '英语 · 四年级', '英語 · 4年'],
    ['Science · Grade 6', '科学 · 六年级', '理科 · 6年'],
    ['Curated books', '预拆图书', '準備済み書籍'],
    ['Book library', '图书馆', 'ブックライブラリ'],
    ['Start with books on business, technology, humanities, and creative work. Each book is already deeply parsed, so a personal course is generated around your goal and available time.', '从商业、科技、人文与创作类书籍开始。书籍已经完成深度拆解，选择后再根据你的目标和时间生成个人课程。', 'ビジネス、テクノロジー、人文、創作系の書籍から始められます。書籍はすでに深く解析済みで、目標と時間に合わせて個人コースを生成します。'],
    ['Reading theme', '阅读主题', 'テーマ'],
    ['For you', '为你推荐', 'おすすめ'],
    ['Business', '商业', 'ビジネス'],
    ['Technology', '科技', 'テクノロジー'],
    ['Management', '管理', 'マネジメント'],
    ['Creativity', '创作', '創作'],
    ['Humanities & history', '人文历史', '人文・歴史'],
    ['Search titles, authors, or topics', '搜索书名、作者或主题', '書名・著者・テーマを検索'],
    ['Creativity & expression', '创作与表达', '創作と表現'],
    ['Organized by interest and learning goals', '根据兴趣和学习目的组织', '興味と学習目的別に整理'],
    ['View book', '查看图书', '本を見る'],
    ['Product · Business', '产品 · 商业', 'プロダクト · ビジネス'],
    ['Management · Communication', '管理 · 沟通', 'マネジメント · コミュニケーション'],
    ['Tech · Industry', '科技 · 产业', 'テクノロジー · 産業'],
    ['Product craft', '产品方法', 'プロダクト手法'],
    ['Management & communication', '管理与沟通', 'マネジメントとコミュニケーション'],
    ['Tech & industry', '科技与产业', 'テクノロジーと産業'],
    ['PRODUCT', '产品', 'プロダクト'],
    ['MANAGEMENT', '管理', 'マネジメント'],
    ['ENERGY', '能源', 'エネルギー'],
    ['Browse by learning goal', '按学习目的浏览', '学習目的から探す'],
    ['No need to declare whether you are a student or an adult first', '不要求用户先声明自己是学生还是成人', '学生か社会人かを先に宣言する必要はありません'],
    ['Quick overview', '快速了解', 'ざっと理解'],
    ['Systematic mastery', '系统掌握', '体系的に習得'],
    ['Solve a work problem', '解决工作问题', '仕事の課題を解決'],
    ['Apply to a project', '应用到项目', 'プロジェクトに応用'],
    ['Create new course', '创建新课程', '新しいコースを作成'],
    ['Choose a textbook, a book, or upload your own material.', '选择教材、图书，或者上传自己的材料。', '教科書・書籍を選ぶか、自分の教材をアップロードします。'],
    ['Choose from textbook library', '从教材库选择', '教科書ライブラリから選ぶ'],
    ['Find school textbooks by stage, grade, subject, and edition.', '按学段、年级、学科和版本找到学校教材。', '学段・学年・科目・版から学校の教科書を探します。'],
    ['Choose from book library', '从图书馆选择', 'ブックライブラリから選ぶ'],
    ['Start with books on business, technology, humanities, and creative work.', '从商业、科技、人文和创作类书籍开始。', 'ビジネス、テクノロジー、人文、創作系の書籍から始めます。'],
    ['Upload your own material', '上传自己的材料', '自分の教材をアップロード'],
    ['Upload PDF, EPUB, Markdown, or plain text.', '上传 PDF、EPUB、Markdown 或纯文本。', 'PDF、EPUB、Markdown、テキストをアップロードします。'],
    ['Back to options', '返回选择', '選択に戻る'],
    ['Add learning material', '添加学习材料', '学習教材を追加'],
    ['Drop a file here or choose one from your device. Core v1 starts each course with one piece of material.', '把文件拖到这里，或者从设备中选择。Core v1 每门课程先从一份材料开始。', 'ファイルをここにドロップするか、デバイスから選択します。Core v1 では各コース1つの教材から始めます。'],
    ['Choose file', '选择文件', 'ファイルを選択'],
    ['Supports PDF, EPUB, Markdown, and plain text', '支持 PDF、EPUB、Markdown 和纯文本', 'PDF、EPUB、Markdown、テキストに対応'],
    ['Learning material', '学习材料', '学習教材'],
    ['Creating course', '正在创建课程', 'コースを作成中'],
    ['After the upload finishes, Lucubro understands the material and shows a course outline you can confirm and adjust.', '上传完成后会自动理解材料，并展示可以确认和修改的课程大纲。', 'アップロード完了後、教材を理解し、確認・修正できるコース概要を表示します。'],
    ['Upload material', '上传材料', '教材をアップロード'],
    ['Understand the material', '理解材料内容', '教材を理解'],
    ['Prepare course outline', '准备课程大纲', 'コース概要を準備'],
    ['Enter course', '进入课程', 'コースに入る'],
    ['Understanding the material', '正在理解材料', '教材を理解しています'],
    ['Identifying topics, chapter structure, and evidence in the material.', '正在识别主题、章节结构和材料依据。', 'トピック、章構成、根拠を特定しています。'],
    ['Preparing the course outline', '正在准备课程大纲', 'コース概要を準備しています'],
    ['Next you will see an outline page you can confirm and adjust with one sentence.', '下一步会进入可确认、可用一句话修改的大纲页面。', '次に、確認して一文で修正できる概要ページが表示されます。'],
    ['The course has been created', '课程已经创建', 'コースが作成されました'],
    ['Next you will enter the preparation page and see the course outline.', '接下来进入准备页面，然后展示课程大纲。', '次に準備ページに進み、コース概要を表示します。'],
    ['Back to my learning', '返回我的学习', '学習に戻る'],
    ['Minimize learning context', '最小化学习上下文', '学習コンテキストを最小化'],
    ['Close learning context', '关闭学习上下文', '学習コンテキストを閉じる'],
    ['Resize learning context', '调整学习上下文宽度', '学習コンテキストの幅を調整'],
    ['Open learning context', '打开学习上下文', '学習コンテキストを開く'],
    ['Lesson resources', '课节资料', 'レッスン資料'],
    ['Restore learning context', '恢复学习上下文', '学習コンテキストを復元'],
    ['Toggle focus mode', '切换专注模式', '集中モード切替'],
    ['Enter focus mode', '进入专注模式', '集中モードに入る'],
    ['Exit focus mode', '退出专注模式', '集中モードを終了'],
    ['Focus mode', '专注模式', '集中モード'],
    ['Generate next lesson', '生成下一课', '次のレッスンを生成'],
    ['Restore Lucubro Assistant', '恢复 Lucubro 助手', 'Lucubro アシスタントを復元'],
    ['Course content', '课程内容', 'コースコンテンツ'],
    ['Resize Lucubro Assistant', '调整 Lucubro 助手宽度', 'Lucubro アシスタントの幅を調整'],
    ['Minimize Lucubro Assistant', '最小化 Lucubro 助手', 'Lucubro アシスタントを最小化'],
    ['Close assistant', '关闭助手', 'アシスタントを閉じる'],
    ['Send', '发送', '送信'],
    ['Close sidebar', '关闭侧栏', 'サイドバーを閉じる'],
    ['Success criteria', '成功标准', '成功基準'],
    ['Current constraints', '当前约束', '現在の制約'],
    ['Course promise', '课程承诺', 'コースの約束'],
    ['Current path', '当前路线', '現在のルート'],
    ['Material understanding', '材料理解', '教材の理解'],
    ['Available material scope', '可用材料范围', '利用可能な教材範囲'],
    ['Core methods', '核心方法', '核心メソッド'],
    ['When to use:', '何时使用：', '使いどころ：'],
    ['Boundary:', '边界：', '境界：'],
    ['Learning path', '学习路径', '学習パス'],
    ['Searching related content in the current lesson…', '正在依据当前课节查找相关内容…', '現在のレッスンから関連内容を検索しています…'],
    ['Focus mode on', '已进入专注模式', '集中モードに入りました'],
    ['Learning workspace restored', '已恢复学习工作区', '学習ワークスペースに戻りました'],
    ['This browser does not support course full screen', '当前浏览器不支持课程全屏', 'このブラウザはコースの全画面表示に対応していません'],
    ['Could not enter full screen. Check browser permissions.', '无法进入全屏，请检查浏览器权限', '全画面に入れません。ブラウザの権限を確認してください'],
    ['Exit full screen', '退出全屏', '全画面を終了'],
    ['Source reader', '学习资源阅读器', '学習リソースリーダー'],
    ['Back to course', '返回课程', 'コースに戻る'],
    ['Choose learning resource', '选择学习资源', '学習リソースを選択'],
    ['Show table of contents', '显示目录', '目次を表示'],
    ['Search content', '搜索内容', '内容を検索'],
    ['Search resource content', '搜索资源内容', 'リソース内容を検索'],
    ['Search', '搜索', '検索'],
    ['Previous page', '上一页', '前のページ'],
    ['Page number', '页码', 'ページ番号'],
    ['Next page', '下一页', '次のページ'],
    ['Zoom out', '缩小', '縮小'],
    ['Zoom in', '放大', '拡大'],
    ['Fit width', '适合宽度', '幅に合わせる'],
    ['Fit to width', '适宽', '幅に合わせる'],
    ['Rotate page', '旋转页面', 'ページを回転'],
    ['The file is still safely stored in the course. Try again, or open the original file in a new window.', '文件仍然安全保存在课程中。请重试，或在新窗口打开原文件。', 'ファイルはコース内に安全に保存されています。再試行するか、元のファイルを新しいウィンドウで開いてください。'],
    ['Failed to open resource', '资源打开失败', 'リソースを開けませんでした'],
    ['Learning resource', '学习资源', '学習リソース'],
    ['This file format is not supported yet', '当前文件格式暂不支持', 'このファイル形式はまだ対応していません'],
    ['Ready', '准备就绪', '準備完了'],
    ['Retry saving study draft', '重试保存学习草稿', '学習メモの保存を再試行'],
    ['Retry save', '重试保存', '保存を再試行'],
    ['Draw draft', '画草稿', 'メモを描く'],
    ['Undo last stroke', '撤销上一笔', '一筆戻す'],
    ['Expand study draft', '展开学习草稿', '学習メモを展開'],
    ['Collapse study draft', '收起学习草稿', '学習メモを折りたたむ'],
    ['Draft drawing area', '草稿绘图区', 'メモ描画エリア'],
    ['Write down your reasoning, calculations, or your own understanding…', '写下推演、计算或一句自己的理解…', '推演、計算、自分なりの理解を書きます…'],
    ['Draft', '草稿', '下書き'],
    ['Delete this draft card', '删除这张草稿卡', 'この下書きカードを削除'],
    ['Write your reasoning or understanding…', '写下你的推演或理解…', '推演や理解を書きます…'],
    ['Drawing capacity is full. Undo some strokes to continue.', '绘图容量已满，请撤销部分笔画后继续。', '描画容量がいっぱいです。一部の筆画を取り消してから続けてください。'],
    ['Drawing capacity is full. Current content is kept.', '绘图容量已满，当前内容会保留。', '描画容量がいっぱいです。現在の内容は保持されます。'],
    ['Draft card limit reached. Delete cards you no longer need.', '草稿卡片已达到上限，请删除不再需要的卡片。', '下書きカードが上限に達しました。不要なカードを削除してください。'],
    ['Draft too large to save. Delete some cards or strokes and try again.', '草稿过大，未保存。请删除部分卡片或笔画后重试。', '下書きが大きすぎて保存できません。一部のカードや筆画を削除して再試行してください。'],
    ['Saving…', '保存中…', '保存中…'],
    ['Saved', '已保存', '保存済み'],
    ['Save failed. Content is still on this page.', '保存失败，内容仍在本页。', '保存に失敗しました。内容はこのページに残っています。'],
    ['The draft for this lesson has not been saved yet.', '这节课的草稿尚未保存。', 'このレッスンの下書きはまだ保存されていません。'],
    ['The draft could not be loaded for now.', '草稿暂时没有加载成功。', '下書きを読み込めませんでした。'],
    ['Building the course from your material', '正在根据材料建立课程', '教材からコースを作成しています'],
    ['Lesson files passed backend checks', '课节文件已经通过后端检查', 'レッスンファイルはバックエンドの検査を通過しました'],
    ['Waiting for new generation progress', '正在等待新的生成进度', '新しい生成進捗を待っています'],
    ['Next lesson generation progress', '下一课生成进度', '次のレッスン生成の進捗'],
    ['Course build progress', '课程创建进度', 'コース作成の進捗'],
    ['First lesson generating', '第一课正在生成', '最初のレッスンを生成中'],
    ['Generating next lesson', '正在生成下一课', '次のレッスンを生成中'],
    ['Building explanations and examples…', '正在构建讲解与示范…', '解説と例を作成しています…'],
    ['Generating course', '正在生成课程', 'コースを生成中'],
    ['Please wait patiently', '请耐心等待', 'しばらくお待ちください'],
    ['Course not ready', '课程未就绪', 'コースはまだ準備できていません'],
    ['No lesson files generated yet', '尚未生成课节文件', 'レッスンファイルがまだ生成されていません'],
    ['Course creation did not finish. Return to the library and try again.', '课程创建没有完成，请返回课程库后重试', 'コース作成が完了しませんでした。ライブラリに戻って再試行してください。'],
    ['Next lesson generation did not finish', '下一课生成未完成', '次のレッスン生成が完了しませんでした'],
    ['Course creation progress stopped', '课程创建进度已停止', 'コース作成の進捗は停止しました'],
    ['Next lesson generation progress stopped', '下一课生成进度已停止', '次のレッスン生成の進捗は停止しました'],
    ['Retry generating next lesson', '重试生成下一课', '次のレッスン生成を再試行'],
    ['Retry next lesson', '重试下一课', '次のレッスンを再試行'],
    ['Lucubro is preparing the next lesson. This usually takes a few minutes…', 'Lucubro 正在准备下一课，通常需要几分钟…', 'Lucubro が次のレッスンを準備しています。数分かかります…'],
    ['Lucubro is still processing the previous task. Try again later.', 'Lucubro 正在处理上一项任务，请稍后再试', 'Lucubro は前のタスクを処理中です。しばらくしてから再試行してください'],
    ['Preparing the next lesson…', '正在准备下一课…', '次のレッスンを準備しています…'],
    ['Reconnecting to course generation progress…', '正在连接课程生成进度…', 'コース生成の進捗に再接続しています…'],
    ['Connecting to course generation progress', '正在连接课程生成进度', 'コース生成の進捗に接続しています'],
    ['Understanding material structure', '理解材料结构', '教材構成を理解中'],
    ['Defining learning goals', '确定学习目标', '学習目標を確定中'],
    ['Designing the practice path', '设计练习路线', '練習ルートを設計中'],
    ['Generating question candidates', '生成题目候选', '問題候補を生成中'],
    ['Filtering question quality', '筛选题目质量', '問題の品質を選別中'],
    ['Assembling lessons', '组装课节', 'レッスンを組み立て中'],
    ['Validating the interactive course', '验证互动课程', 'インタラクティブコースを検証中'],
    ['Course preparation complete', '课程准备完成', 'コース準備が完了'],
    ['Reading and organizing material', '读取并整理材料', '教材を読み込み整理中'],
    ['Checking course files', '检查课程文件', 'コースファイルを確認中'],
    ['Material content', '材料内容', '教材コンテンツ'],
    ['Preparing the course generation environment…', '正在准备课程生成环境…', 'コース生成環境を準備しています…'],
    ['Waiting for backend events', '等待后端事件', 'バックエンドのイベントを待機中'],
    ['Waiting for new processing records…', '等待新的处理记录…', '新しい処理記録を待っています…'],
    ['Creating course…', '正在创建课程…', 'コースを作成中…'],
    ['Waiting for the canonical operation projection', '正在等待 canonical operation 投影', 'canonical operation 投影を待機中'],
    ['Course setup steps', '建课步骤', 'コース作成ステップ'],
    ['Back to course list', '返回课程列表', 'コース一覧に戻る'],
    ['User avatar', '用户头像', 'ユーザーアバター'],
    ['Remove file', '移除文件', 'ファイルを削除'],
    ['Material upload progress', '材料上传进度', '教材アップロードの進捗'],
    ['Uploading material', '正在上传材料', '教材をアップロード中'],
    ['Continue in background', '在后台继续', 'バックグラウンドで続行'],
    ['Material is saved. You can leave this page and continue in the background.', '材料已保留，可以离开此页在后台继续', '教材は保存されています。このページを離れてバックグラウンドで続行できます。'],
    ['Reading material', '正在读取材料', '教材を読み込み中'],
    ['First lesson is ready', '第一课已准备好', '最初のレッスンの準備ができました'],
    ['Learning area is ready', '学习区域已准备好', '学習エリアの準備ができました'],
    ['Opening the first lesson', '正在打开第一课', '最初のレッスンを開いています'],
    ['Retry creation', '重试创建', '作成を再試行'],
    ['Read material', '读取材料', '教材を読み込む'],
    ['Review structure', '梳理结构', '構成を整理'],
    ['Set up goals', '建立目标', '目標を設定'],
    ['Organize course', '组织课程', 'コースを構成'],
    ['Generate practice', '生成练习', '練習を生成'],
    ['Filter quality', '筛选质量', '品質を選別'],
    ['Assemble first lesson', '组装第一课', '最初のレッスンを組み立て'],
    ['Check course', '检查课程', 'コースを確認'],
    ['Almost done', '准备完成', '準備完了'],
    ['Only PDF, EPUB, Markdown, and TXT files are supported.', '仅支持 PDF、EPUB、Markdown 和 TXT 文件。', 'PDF、EPUB、Markdown、TXT ファイルのみ対応しています。'],
    ['The file is empty. Choose different material.', '文件为空，请选择其他材料。', 'ファイルが空です。別の教材を選んでください。'],
    ['The file exceeds the 200 MB limit.', '文件超过 200 MB 限制。', 'ファイルは 200 MB の上限を超えています。'],
    ['Upload complete. Checking the material', '上传完成，正在检查材料', 'アップロード完了。教材を確認中'],
    ['Checking your material', '正在检查你的材料', '教材を確認しています'],
    ['Confirming file format, content structure, and readability.', '正在确认文件格式、内容结构和可读取性。', 'ファイル形式、内容構成、可読性を確認しています。'],
    ['Material upload or check failed. Try again.', '材料上传或检查失败，请重试。', '教材のアップロードまたは確認に失敗しました。再試行してください。'],
    ['The connection was interrupted and the material did not finish uploading.', '网络连接中断，材料没有完成上传。', '接続が中断され、教材のアップロードが完了しませんでした。'],
    ['Confirm learning goal', '确认学习目标', '学習目標を確定'],
    ['Learning goal options are ready.', '学习目标已经整理完成。', '学習目標の候補がそろいました。'],
    ['Confirm and create course', '确认并创建课程', '確定してコースを作成'],
    ['Learning goals were not fully prepared', '学习目标没有整理完成', '学習目標の準備が完了しませんでした'],
    ['Your material and everything you filled in are saved. You can try again.', '材料和已经填写的内容都已保留，可以重试。', '教材と入力済みの内容は保存されています。再試行できます。'],
    ['Retrying continues the current interview. No need to upload again, and course generation does not start early.', '重试会从当前访谈继续，不需要重新上传材料，也不会提前开始生成课程。', '再試行は現在のインタビューから続きます。再アップロードは不要で、コース生成が先に始まることもありません。'],
    ['Continue organizing', '继续整理', '整理を続ける'],
    ['Preparing the next question', '正在准备下一个问题', '次の質問を準備しています'],
    ['Choose the closest option', '选择最接近的一项', '最も近いものを選択'],
    ['Learning goal options', '学习目标选项', '学習目標の選択肢'],
    ['Your answer', '你的回答', 'あなたの回答'],
    ['Add your specific context, goal, or constraints. You can also continue without filling this in.', '可以补充你的具体场景、目标或限制；不填也可以继续。', '具体的な場面、目標、制約を補足できます。未入力のまま続行もできます。'],
    ['Write down your specific goal or use case.', '写下你的具体目标或使用场景。', '具体的な目標や利用場面を書きます。'],
    ['View material summary', '查看材料摘要', '教材の要約を見る'],
    ['The request did not complete', '请求没有完成', 'リクエストが完了しませんでした'],
    ['Choose the closest answer first', '请先选择一个最接近的答案', '先に最も近い答えを選んでください'],
    ['Answer this question first', '请先回答这个问题', '先にこの質問に答えてください'],
    ['The learning goal was not saved. Your material and everything you filled in are saved. You can try again.', '学习目标没有保存。材料和已经填写的内容都已保留，可以重试。', '学習目標が保存されませんでした。教材と入力済みの内容は保存されています。再試行できます。'],
    ['Learning settings were not saved', '学习设置没有保存', '学習設定が保存されませんでした'],
    ['The course creation did not finish', '课程创建没有完成', 'コース作成が完了しませんでした'],
    ['Connection lost. Reconnecting…', '连接暂时中断，正在恢复…', '接続が一時中断されました。復帰しています…'],
    ['Course creation status not found', '没有找到建课状态', 'コース作成の状態が見つかりません'],
    ['Course creation did not finish. Please try again.', '课程创建没有完成，请重试。', 'コース作成が完了しませんでした。再試行してください。'],
    ['The material check did not finish. Upload again.', '材料检查没有完成，请重新上传。', '教材の確認が完了しませんでした。再アップロードしてください。'],
    ['Submit answer', '提交回答', '回答を送信'],
    ['Check answer', '检查答案', '答えを確認'],
    ['Show hint', '查看提示', 'ヒントを見る'],
    ['Enter your answer', '请输入你的回答', '回答を入力してください'],
    ['Quick check', '快速诊断', 'クイック診断'],
    ['Demonstration', '示范', 'デモ'],
    ['Guided practice', '引导练习', 'ガイド付き練習'],
    ['Independent practice', '独立练习', '自立練習'],
    ['Application task', '应用任务', '応用タスク'],
    ['Exit check', '离堂检测', '退出チェック'],
    ['Targeted review', '针对性补练', '重点補習'],
    ['Practice', '练习', '練習'],
    ['Done.', '已完成。', '完了しました。'],
    ['Try again.', '请再试一次。', 'もう一度試してください。'],
    ['Submission failed', '提交失败', '送信に失敗しました'],
    ['Move up', '上移', '上へ移動'],
    ['Move down', '下移', '下へ移動'],
    ['Check order', '检查顺序', '順序を確認'],
    ['Start recording', '开始录音', '録音開始'],
    ['Stop', '停止', '停止'],
    ['I replayed it and finished', '我已回放并完成', '再生して完了しました'],
    ['Ask Lucubro', '问 Lucubro', 'Lucubro に聞く'],
    ['Take note', '记笔记', 'メモする'],
    ['Send to draft', '放到草稿', 'メモに送る'],
    ['Text selection actions', '选中文本操作', '選択テキストの操作'],
    ['Guess first, then read the explanation.', '先猜一下，再看解释。', 'まず予想してから説明を読みましょう。'],
    ['See why', '看看为什么', '理由を見る'],
    ['Make a prediction before viewing the explanation.', '先做出预测，再查看解释。', '説明を見る前に予想しましょう。'],
    ['Curiosity', '好奇', '好奇心'],
    ['Add to draft', '添加到草稿', '下書きに追加'],
    ['Explain this question using the current lesson:', '请结合当前课节解释这个问题：', '現在のレッスンを使って、この質問を説明してください：'],
    ['Back to course library', '返回课程库', 'コースライブラリに戻る'],
    ['Course creation steps', '课程创建步骤', 'コース作成ステップ'],
    ['Set goal', '设定目标', '目標を設定'],
    ['Create course', '创建课程', 'コースを作成'],
    ['Current step', '当前步骤', '現在のステップ'],
    ['Completed step', '已完成步骤', '完了したステップ'],
    ['Upcoming step', '未到达步骤', '未到達のステップ'],
    ['Preparing the first lesson', '正在准备第一课', '最初のレッスンを準備中'],
    ['No courses yet', '还没有课程', 'コースはまだありません'],
    ['Upload material to create your first course.', '上传材料，创建你的第一门课程。', '教材をアップロードして最初のコースを作成します。'],
    ['Create another course', '创建另一门课程', '別のコースを作成'],
    ['Upload material to create your next course.', '上传材料，创建下一门课程。', '教材をアップロードして次のコースを作成します。'],
    ['This note has no content yet.', '这条笔记还没有内容。', 'このノートにはまだ内容がありません。'],
    ['Edit', '编辑', '編集'],
    ['Add note', '添加笔记', 'ノートを追加'],
    ['Add a note', '添加笔记', 'ノートを追加'],
    ['Delete this note?', '删除这条笔记？', 'このノートを削除しますか？'],
    ['Show in lesson', '回到原文', '本文で表示'],
    ['Lesson notes', '本课笔记', 'レッスンノート'],
    ['Open note', '查看笔记', 'ノートを開く'],
    ['From the lesson', '原文摘录', 'レッスンからの引用'],
    ['Select a passage in the lesson to add your first note.', '选择课节中的一段文字，开始记录第一条笔记。', 'レッスンの文章を選択して、最初のノートを追加しましょう。'],
    ['Write what you understood, questioned, or want to use…', '写下你的理解、疑问，或准备实际使用的内容…', '理解したこと、疑問、実際に使いたいことを書きます…'],
    ['The lesson changed, so this note is no longer linked to an exact passage.', '课节内容发生了变化，这条笔记暂时无法定位到原文。', 'レッスンが更新されたため、元の箇所に正確に移動できません。'],
    ['My note', '我的笔记', '自分のノート'],
    ['Lucubro note', 'Lucubro 笔记', 'Lucubro ノート'],
    ['Question', '问题', '質問'],
    ['This note cannot be opened right now. Course content is not affected.', '这条笔记暂时无法打开，课程内容没有受到影响。', 'このノートは現在開けません。レッスン内容には影響ありません。'],
    ['Learning activity by day', '每天的学习活动', '日別の学習アクティビティ'],
    ['Activity intensity', '活动强度', 'アクティビティ強度'],
    ['Close generation panel', '关闭生成过程', '生成パネルを閉じる'],
    ['Generation stages', '生成阶段', '生成ステージ'],
    ['Clear history and start a new chat', '清空记录，开始新对话', '履歴を消去して新しい会話を開始'],
    ['Initialization progress', '初始化进度', '初期化の進捗'],
  ];

  const messages = Object.fromEntries(phraseEntries.map(([en, zh, ja]) => [en, { en, 'zh-CN': zh, ja }]));
  const aliases = new Map();
  for (const [key, translations] of Object.entries(messages)) {
    for (const value of Object.values(translations)) aliases.set(value, key);
  }

  function normalizeLocale(value) {
    const raw = String(value || '').toLowerCase();
    if (raw === 'zh' || raw.startsWith('zh-')) return 'zh-CN';
    if (raw === 'ja' || raw.startsWith('ja-')) return 'ja';
    return 'en';
  }

  function initialLocale() {
    const query = new URLSearchParams(location.search).get('lang');
    if (query) return normalizeLocale(query);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeLocale(saved);
    } catch {}
    return 'en';
  }

  let locale = initialLocale();

  function interpolate(value, params = {}) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''));
  }

  function t(key, params = {}) {
    const entry = messages[key];
    return interpolate(entry?.[locale] || entry?.en || key, params);
  }

  function translatePattern(value) {
    const rules = [
      {
        sources: [/^(\d+|…) 节课 · (\d+) 份材料$/, /^(\d+|…) lessons? · (\d+) sources?$/, /^(\d+|…) レッスン · 教材 (\d+) 件$/],
        render: (a, b) => locale === 'zh-CN' ? `${a} 节课 · ${b} 份材料` : locale === 'ja' ? `${a} レッスン · 教材 ${b} 件` : `${a} ${a === '1' ? 'lesson' : 'lessons'} · ${b} ${b === '1' ? 'source' : 'sources'}`,
      },
      {
        sources: [/^(\d+|…) 节课 · ([A-Z]+) 材料$/, /^(\d+|…) lessons? · ([A-Z]+) source$/, /^(\d+|…) レッスン · ([A-Z]+) 教材$/],
        render: (a, b) => locale === 'zh-CN' ? `${a} 节课 · ${b} 材料` : locale === 'ja' ? `${a} レッスン · ${b} 教材` : `${a} ${a === '1' ? 'lesson' : 'lessons'} · ${b} source`,
      },
      {
        sources: [/^已生成 (\d+) 节课$/, /^(\d+) lessons? created$/, /^(\d+) レッスンを作成済み$/],
        render: (a) => locale === 'zh-CN' ? `已生成 ${a} 节课` : locale === 'ja' ? `${a} レッスンを作成済み` : `${a} ${a === '1' ? 'lesson' : 'lessons'} created`,
      },
      {
        sources: [/^正在学习 Lesson (\d+)$/, /^正在学习第 (\d+) 课$/, /^Learning · Lesson (\d+)$/, /^学習中 · Lesson (\d+)$/, /^レッスン (\d+) を学習中$/],
        render: (a) => locale === 'zh-CN' ? `正在学习第 ${a} 课` : locale === 'ja' ? `レッスン ${a} を学習中` : `Learning · Lesson ${a}`,
      },
      {
        sources: [/^第 (\d+) 课( · .+)?$/, /^Lesson (\d+)( · .+)?$/, /^レッスン (\d+)( · .+)?$/],
        render: (a, rest = '') => locale === 'zh-CN' ? `第 ${a} 课${rest}` : locale === 'ja' ? `レッスン ${a}${rest}` : `Lesson ${a}${rest}`,
      },
      {
        sources: [/^当前上下文：(.*)$/, /^Current context: (.*)$/, /^現在のコンテキスト：(.*)$/],
        render: (a) => locale === 'zh-CN' ? `当前上下文：${translated(a)}` : locale === 'ja' ? `現在のコンテキスト：${translated(a)}` : `Current context: ${translated(a)}`,
      },
      {
        sources: [/^掌握《(.+)》的核心内容与方法$/, /^Master the core ideas and methods in “(.+)”$/, /^『(.+)』の中心的な考え方と方法を身につける$/],
        render: (a) => locale === 'zh-CN' ? `掌握《${a}》的核心内容与方法` : locale === 'ja' ? `『${a}』の中心的な考え方と方法を身につける` : `Master the core ideas and methods in “${a}”`,
      },
      {
        sources: [/^已停止 · (.+)$/, /^Stopped · (.+)$/, /^停止 · (.+)$/],
        render: (a) => locale === 'zh-CN' ? `已停止 · ${a}` : locale === 'ja' ? `停止 · ${a}` : `Stopped · ${a}`,
      },
      {
        sources: [/^已用 (.+)$/, /^Elapsed (.+)$/, /^経過 (.+)$/],
        render: (a) => locale === 'zh-CN' ? `已用 ${a}` : locale === 'ja' ? `経過 ${a}` : `Elapsed ${a}`,
      },
      {
        sources: [/^正在创建课程 · ([A-Z]+)，1 份材料$/, /^Creating course · ([A-Z]+), 1 source$/, /^コース作成中 · ([A-Z]+)、教材 1 件$/],
        render: (a) => locale === 'zh-CN' ? `正在创建课程 · ${a}，1 份材料` : locale === 'ja' ? `コース作成中 · ${a}、教材 1 件` : `Creating course · ${a}, 1 source`,
      },
      {
        sources: [/^等待学习设置 · ([A-Z]+)，1 份材料$/, /^Waiting for learning setup · ([A-Z]+), 1 source$/, /^学習設定待ち · ([A-Z]+)、教材 1 件$/],
        render: (a) => locale === 'zh-CN' ? `等待学习设置 · ${a}，1 份材料` : locale === 'ja' ? `学習設定待ち · ${a}、教材 1 件` : `Waiting for learning setup · ${a}, 1 source`,
      },
      {
        sources: [/^创建未完成，可重试 · ([A-Z]+)，1 份材料$/, /^Creation failed, retry available · ([A-Z]+), 1 source$/, /^作成未完了・再試行可 · ([A-Z]+)、教材 1 件$/],
        render: (a) => locale === 'zh-CN' ? `创建未完成，可重试 · ${a}，1 份材料` : locale === 'ja' ? `作成未完了・再試行可 · ${a}、教材 1 件` : `Creation failed, retry available · ${a}, 1 source`,
      },
      {
        sources: [/^(\d+|…) 节课 · ([A-Z]+)，1 份材料$/, /^(\d+|…) lessons? · ([A-Z]+), 1 source$/, /^(\d+|…) レッスン · ([A-Z]+)、教材 1 件$/],
        render: (a, b) => locale === 'zh-CN' ? `${a} 节课 · ${b}，1 份材料` : locale === 'ja' ? `${a} レッスン · ${b}、教材 1 件` : `${a} ${a === '1' ? 'lesson' : 'lessons'} · ${b}, 1 source`,
      },
      {
        sources: [/^(\d+) 节课可学习$/, /^(\d+) lessons? available$/, /^(\d+) レッスンを学習可能$/],
        render: (a) => locale === 'zh-CN' ? `${a} 节课可学习` : locale === 'ja' ? `${a} レッスンを学習可能` : `${a} ${a === '1' ? 'lesson' : 'lessons'} available`,
      },
      {
        sources: [/^([A-Z]+) 材料 · (\d+) \/ (\d+)$/, /^([A-Z]+) source · (\d+) \/ (\d+)$/, /^([A-Z]+) 教材 · (\d+) \/ (\d+)$/],
        render: (a, b, c) => locale === 'zh-CN' ? `${a} 材料 · ${b} / ${c}` : locale === 'ja' ? `${a} 教材 · ${b} / ${c}` : `${a} source · ${b} / ${c}`,
      },
      {
        sources: [/^(\d+) 条$/, /^(\d+) notes?$/, /^(\d+) 件$/],
        render: (a) => locale === 'zh-CN' ? `${a} 条` : locale === 'ja' ? `${a} 件` : `${a} ${a === '1' ? 'note' : 'notes'}`,
      },
      {
        sources: [/^(\d+) 节课$/, /^(\d+) lessons?$/, /^(\d+) レッスン$/],
        render: (a) => locale === 'zh-CN' ? `${a} 节课` : locale === 'ja' ? `${a} レッスン` : `${a} ${a === '1' ? 'lesson' : 'lessons'}`,
      },
      {
        sources: [/^(\d+) 项$/, /^(\d+) items?$/, /^(\d+) 項目$/],
        render: (a) => locale === 'zh-CN' ? `${a} 项` : locale === 'ja' ? `${a} 項目` : `${a} ${a === '1' ? 'item' : 'items'}`,
      },
      {
        sources: [/^阅读进度 (\d+)%$/, /^Reading progress (\d+)%$/, /^読書進捗 (\d+)%$/],
        render: (a) => locale === 'zh-CN' ? `阅读进度 ${a}%` : locale === 'ja' ? `読書進捗 ${a}%` : `Reading progress ${a}%`,
      },
      {
        sources: [/^([A-Z]+) 材料$/, /^([A-Z]+) source$/, /^([A-Z]+) 教材$/],
        render: (a) => locale === 'zh-CN' ? `${a} 材料` : locale === 'ja' ? `${a} 教材` : `${a} source`,
      },
      {
        sources: [/^(\d+) 个$/, /^(\d+)$/],
        render: (a) => `${a}`,
      },
      {
        sources: [/^(\d+) 个能力切片$/, /^(\d+) skill slices$/, /^(\d+) つの能力スライス$/],
        render: (a) => locale === 'zh-CN' ? `${a} 个能力切片` : locale === 'ja' ? `${a} つの能力スライス` : `${a} skill slices`,
      },
      {
        sources: [/^原始材料 · ([A-Z]+)$/, /^Original material · ([A-Z]+)$/, /^原資料 · ([A-Z]+)$/],
        render: (a) => locale === 'zh-CN' ? `原始材料 · ${a}` : locale === 'ja' ? `原資料 · ${a}` : `Original material · ${a}`,
      },
      {
        sources: [/^已用时 (.+)$/, /^Elapsed (.+)$/, /^経過 (.+)$/],
        render: (a) => locale === 'zh-CN' ? `已用时 ${a}` : locale === 'ja' ? `経過 ${a}` : `Elapsed ${a}`,
      },
      {
        sources: [/^(.+) · 已准备好$/, /^(.+) · ready$/, /^(.+) · 準備完了$/],
        render: (a) => locale === 'zh-CN' ? `${a} · 已准备好` : locale === 'ja' ? `${a} · 準備完了` : `${a} · ready`,
      },
      {
        sources: [/^(.+) · 已上传$/, /^(.+) · uploaded$/, /^(.+) · アップロード済み$/],
        render: (a) => locale === 'zh-CN' ? `${a} · 已上传` : locale === 'ja' ? `${a} · アップロード済み` : `${a} · uploaded`,
      },
      {
        sources: [/^(.+) · 学习目标$/, /^(.+) · Learning goal$/, /^(.+) · 学習目標$/],
        render: (a) => locale === 'zh-CN' ? `${a} · 学习目标` : locale === 'ja' ? `${a} · 学習目標` : `${a} · Learning goal`,
      },
      {
        sources: [/^(\d+) 节课 · 学习区域已建立$/, /^(\d+) lessons? · learning area created$/, /^(\d+) レッスン · 学習エリアを作成済み$/],
        render: (a) => locale === 'zh-CN' ? `${a} 节课 · 学习区域已建立` : locale === 'ja' ? `${a} レッスン · 学習エリアを作成済み` : `${a} ${a === '1' ? 'lesson' : 'lessons'} · learning area created`,
      },
      {
        sources: [/^(.+) 材料和已确认的学习设置仍然保留。$/, /^(.+) Your material and confirmed learning settings are still saved\.$/, /^(.+) 教材と確認済みの学習設定は保存されています。$/],
        render: (a) => locale === 'zh-CN' ? `${a} 材料和已确认的学习设置仍然保留。` : locale === 'ja' ? `${a} 教材と確認済みの学習設定は保存されています。` : `${a} Your material and confirmed learning settings are still saved.`,
      },
      {
        sources: [/^删除《(.+)》？此操作不可恢复。$/, /^Delete “(.+)”\? This cannot be undone\.$/, /^『(.+)』を削除しますか？この操作は元に戻せません。$/],
        render: (a) => locale === 'zh-CN' ? `删除《${a}》？此操作不可恢复。` : locale === 'ja' ? `『${a}』を削除しますか？この操作は元に戻せません。` : `Delete “${a}”? This cannot be undone.`,
      },
      {
        sources: [/^创建未完成 · (.+)$/, /^Creation unfinished · (.+)$/, /^作成未完了 · (.+)$/],
        render: (a) => locale === 'zh-CN' ? `创建未完成 · ${a}` : locale === 'ja' ? `作成未完了 · ${a}` : `Creation unfinished · ${a}`,
      },
      {
        sources: [/^正在打开 (.+)$/, /^Opening (.+)$/, /^(.+) を開いています$/],
        render: (a) => locale === 'zh-CN' ? `正在打开 ${a}` : locale === 'ja' ? `${a} を開いています` : `Opening ${a}`,
      },
      {
        sources: [/^无法加载 (.+)$/, /^Could not load (.+)$/, /^(.+) を読み込めませんでした$/],
        render: (a) => locale === 'zh-CN' ? `无法加载 ${a}` : locale === 'ja' ? `${a} を読み込めませんでした` : `Could not load ${a}`,
      },
      {
        sources: [/^草稿 (\d+)$/, /^Draft (\d+)$/, /^下書き (\d+)$/],
        render: (a) => locale === 'zh-CN' ? `草稿 ${a}` : locale === 'ja' ? `下書き ${a}` : `Draft ${a}`,
      },
      {
        sources: [/^(\d+) 条笔记$/, /^(\d+) notes$/, /^(\d+)件のノート$/],
        render: (a) => locale === 'zh-CN' ? `${a} 条笔记` : locale === 'ja' ? `${a}件のノート` : `${a} ${a === '1' ? 'note' : 'notes'}`,
      },
      {
        sources: [/^Note on “(.+)”$/, /^为「(.+)」添加笔记$/, /^「(.+)」のノート$/],
        render: (a) => locale === 'zh-CN' ? `为「${a}」添加笔记` : locale === 'ja' ? `「${a}」のノート` : `Note on “${a}”`,
      },
      {
        sources: [/^✓ 已证明：(.+)$/, /^✓ Demonstrated: (.+)$/, /^✓ 証明済み：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `✓ 已证明：${a}` : locale === 'ja' ? `✓ 証明済み：${a}` : `✓ Demonstrated: ${a}`,
      },
      {
        sources: [/^(.+)：已通过 (\d+)\/(\d+) 个必要练习$/, /^(.+): passed (\d+)\/(\d+) required exercises$/, /^(.+)：必須練習 (\d+)\/(\d+) を通過$/],
        render: (a, b, c) => locale === 'zh-CN' ? `${a}：已通过 ${b}/${c} 个必要练习` : locale === 'ja' ? `${a}：必須練習 ${b}/${c} を通過` : `${a}: passed ${b}/${c} required exercises`,
      },
      {
        sources: [/^无法开始录音：(.+)$/, /^Could not start recording: (.+)$/, /^録音を開始できません：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `无法开始录音：${a}` : locale === 'ja' ? `録音を開始できません：${a}` : `Could not start recording: ${a}`,
      },
      {
        sources: [/^例句：(.+)$/, /^Example: (.+)$/, /^例：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `例句：${a}` : locale === 'ja' ? `例：${a}` : `Example: ${a}`,
      },
      {
        sources: [/^依据：(.+)$/, /^Source: (.+)$/, /^根拠：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `依据：${a}` : locale === 'ja' ? `根拠：${a}` : `Source: ${a}`,
      },
      {
        sources: [/^为什么和本课有关：(.+)$/, /^Why it relates to this lesson: (.+)$/, /^このレッスンとの関連：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `为什么和本课有关：${a}` : locale === 'ja' ? `このレッスンとの関連：${a}` : `Why it relates to this lesson: ${a}`,
      },
      {
        sources: [/^朗读英语单词 (.+)$/, /^Read the English word aloud: (.+)$/, /^英単語を読み上げる：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `朗读英语单词 ${a}` : locale === 'ja' ? `英単語を読み上げる：${a}` : `Read the English word aloud: ${a}`,
      },
      {
        sources: [/^点击朗读：(.+)$/, /^Click to hear: (.+)$/, /^クリックして読み上げ：(.+)$/],
        render: (a) => locale === 'zh-CN' ? `点击朗读：${a}` : locale === 'ja' ? `クリックして読み上げ：${a}` : `Click to hear: ${a}`,
      },
    ];
    for (const rule of rules) {
      for (const source of rule.sources) {
        const match = value.match(source);
        if (match) return rule.render(...match.slice(1));
      }
    }
    return value;
  }

  function translated(value) {
    const key = aliases.get(value);
    return key ? t(key) : translatePattern(value);
  }

  function translateTextNode(node) {
    const raw = node.nodeValue || '';
    const trimmed = raw.trim();
    if (!trimmed) return;
    const next = translated(trimmed);
    if (next === trimmed) return;
    const start = raw.match(/^\s*/)?.[0] || '';
    const end = raw.match(/\s*$/)?.[0] || '';
    node.nodeValue = `${start}${next}${end}`;
  }

  function translateAttributes(element) {
    for (const attribute of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const next = translated(value);
      if (next !== value) element.setAttribute(attribute, next);
    }
  }

  function apply(target = document) {
    const rootNode = target.nodeType === Node.DOCUMENT_NODE ? target.documentElement : target;
    if (!rootNode || rootNode.closest?.('[data-i18n-ignore]')) return;
    if (rootNode.nodeType === Node.TEXT_NODE) {
      translateTextNode(rootNode);
      return;
    }
    if (rootNode.matches?.('script, style, code, pre, textarea, [data-i18n-ignore]')) return;
    if (rootNode.nodeType === Node.ELEMENT_NODE) translateAttributes(rootNode);
    const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        return parent?.closest('script, style, code, pre, textarea, [data-i18n-ignore]')
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else translateAttributes(node);
    }
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
  }

  function mountSwitcher() {
    if (document.querySelector('.lucubro-language-switcher')) return;
    const host = document.querySelector('.notes-header-actions')
      || document.querySelector('.course-topbar, .topbar-inner')
      || document.querySelector('.site-header, .appbar-inner, .topbar');
    if (!host) return;
    const label = document.createElement('label');
    label.className = 'lucubro-language-switcher';
    label.setAttribute('aria-label', 'Language');
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Language');
    for (const [value, text] of [['en', 'EN'], ['zh-CN', '中文'], ['ja', '日本語']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      option.selected = value === locale;
      select.appendChild(option);
    }
    select.addEventListener('change', () => setLocale(select.value));
    label.appendChild(select);
    const anchor = host.querySelector('.header-action, .app-actions, .top-actions, .topbar-actions');
    if (anchor) {
      let directAnchor = anchor;
      while (directAnchor.parentElement && directAnchor.parentElement !== host) directAnchor = directAnchor.parentElement;
      if (directAnchor.parentElement === host) host.insertBefore(label, directAnchor);
      else host.appendChild(label);
    } else host.appendChild(label);
  }

  function setLocale(nextLocale) {
    locale = normalizeLocale(nextLocale);
    try { localStorage.setItem(STORAGE_KEY, locale); } catch {}
    document.querySelectorAll('.lucubro-language-switcher select').forEach((select) => {
      select.value = locale;
    });
    apply(document);
    root.dispatchEvent(new CustomEvent('lucubro:localechange', { detail: { locale } }));
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData') apply(mutation.target);
      else if (mutation.type === 'attributes') translateAttributes(mutation.target);
      mutation.addedNodes.forEach(apply);
    }
  });

  const api = {
    get locale() { return locale; },
    locales: [...LOCALES],
    normalizeLocale,
    setLocale,
    t,
    apply,
  };
  root.LucubroI18n = api;

  function start() {
    apply(document);
    mountSwitcher();
    apply(document);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title', 'placeholder', 'alt'] });
    document.documentElement.classList.add('i18n-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
