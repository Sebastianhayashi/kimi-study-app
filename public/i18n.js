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
    ['into a course', '变成一门课', '学べるコースへ'],
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
    ['Upload material, choose a goal, then start the first lesson.', '上传材料，选定目标，然后开始第一课。', '教材を追加し、目標を選び、最初のレッスンを始めます。'],
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
        sources: [/^正在学习 Lesson (\d+)$/, /^Learning · Lesson (\d+)$/, /^学習中 · Lesson (\d+)$/],
        render: (a) => locale === 'zh-CN' ? `正在学习 Lesson ${a}` : locale === 'ja' ? `学習中 · Lesson ${a}` : `Learning · Lesson ${a}`,
      },
      {
        sources: [/^当前上下文：(.*)$/, /^Current context: (.*)$/, /^現在のコンテキスト：(.*)$/],
        render: (a) => locale === 'zh-CN' ? `当前上下文：${a}` : locale === 'ja' ? `現在のコンテキスト：${a}` : `Current context: ${a}`,
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
        sources: [/^正在创建课程 · ([A-Z]+) · 1 份材料$/, /^Creating course · ([A-Z]+) · 1 source$/, /^コース作成中 · ([A-Z]+) · 教材 1 件$/],
        render: (a) => locale === 'zh-CN' ? `正在创建课程 · ${a} · 1 份材料` : locale === 'ja' ? `コース作成中 · ${a} · 教材 1 件` : `Creating course · ${a} · 1 source`,
      },
      {
        sources: [/^创建未完成，可重试 · ([A-Z]+) · 1 份材料$/, /^Creation failed, retry available · ([A-Z]+) · 1 source$/, /^作成未完了・再試行可 · ([A-Z]+) · 教材 1 件$/],
        render: (a) => locale === 'zh-CN' ? `创建未完成，可重试 · ${a} · 1 份材料` : locale === 'ja' ? `作成未完了・再試行可 · ${a} · 教材 1 件` : `Creation failed, retry available · ${a} · 1 source`,
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
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.documentElement.classList.add('i18n-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
