// ==================== 全局状态 ====================
let appData = null;
let currentPageId = null;
let currentCategory = 'all';
let hideTimer = null;
let activeTooltip = null;
let currentZIndex = 100; // 层级管理
// ==================== 掌握状态持久化 (localStorage) ====================
// 从本地存储读取已掌握的单词 ID 集合
let masteredWords = new Set(JSON.parse(localStorage.getItem('mastered_words') || '[]'));

// 辅助函数：将状态保存到本地存储
function saveMasteredWords() {
    localStorage.setItem('mastered_words', JSON.stringify(Array.from(masteredWords)));
}

// ==================== 语音优化 ====================
let availableVoices = [];
const SpeakerIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8.5v7a4.49 4.49 0 002.5-3.5zM14 3.23v2.06A7.007 7.007 0 0119 12a7.007 7.007 0 01-5 6.71v2.06A9.01 9.01 0 0021 12 9.01 9.01 0 0014 3.23z"/></svg>`;

function loadVoices() {
    availableVoices = speechSynthesis.getVoices();
}
loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text, lang, btnEl) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.volume = 1.0;

    if (lang === 'en-US') {
        u.lang = 'en-US'; u.rate = 0.95; u.pitch = 1.1;
    } else {
        u.lang = 'en-GB'; u.rate = 0.9; u.pitch = 1.0;
    }

    const targetLang = lang;
    const voicePriority = [
        v => v.name.includes('Google') && v.lang === targetLang,
        v => v.name.includes('Samantha') && v.lang === targetLang,
        v => v.name.includes('Daniel') && v.lang === targetLang,
        v => v.lang === targetLang,
        v => v.lang.startsWith(targetLang.split('-')[0])
    ];

    for (const check of voicePriority) {
        const voice = availableVoices.find(check);
        if (voice) { u.voice = voice; break; }
    }

    if (btnEl) {
        btnEl.classList.add('speaking');
        u.onend = () => btnEl.classList.remove('speaking');
        u.onerror = () => btnEl.classList.remove('speaking');
    }
    speechSynthesis.speak(u);
}

// ==================== Tooltip 控制 (含边界检测) ====================
function showTooltip(tooltipEl, hotspotEl) {
    clearTimeout(hideTimer);
    hideTimer = null;

    // 关闭其他
    if (activeTooltip && activeTooltip !== tooltipEl) {
        activeTooltip.classList.remove('show', 'tooltip-left');
        const prevContainer = activeTooltip.closest('.hotspot-container');
        if (prevContainer) {
            prevContainer.style.zIndex = '';
            prevContainer.querySelector('.hotspot')?.classList.remove('active');
        }
    }

    // 提升层级
    currentZIndex++;
    const container = tooltipEl.closest('.hotspot-container');
    container.style.zIndex = currentZIndex;

    // 1. 先默认显示在右侧 (移除左侧类)
    tooltipEl.classList.remove('tooltip-left');
    
    // 2. 显示 tooltip (此时可以获取真实尺寸)
    tooltipEl.classList.add('show');
    hotspotEl.classList.add('active');
    activeTooltip = tooltipEl;

    // 3. 边界检测：如果右侧超出图片边界，切换到左侧
    // 使用 setTimeout 0 确保 DOM 渲染完成
    setTimeout(() => {
        const tooltipRect = tooltipEl.getBoundingClientRect();
        const wrapperRect = document.getElementById('imageWrapper').getBoundingClientRect();
        
        // 如果 tooltip 的右边缘 > 图片容器的右边缘 (留 10px 缓冲)
        if (tooltipRect.right > wrapperRect.right - 10) {
            tooltipEl.classList.add('tooltip-left');
        }
    }, 0);
}

function scheduleHide(tooltipEl, hotspotEl) {
    hideTimer = setTimeout(() => {
        tooltipEl.classList.remove('show', 'tooltip-left');
        hotspotEl.classList.remove('active');
        if (activeTooltip === tooltipEl) {
            activeTooltip = null;
            const container = tooltipEl.closest('.hotspot-container');
            if (container) container.style.zIndex = '';
        }
    }, 300);
}

// ==================== 渲染页面 ====================
function renderPage(pageId) {
    console.log('渲染页面:', pageId);
    const page = appData.pages.find(p => p.id === pageId);
    if (!page) return;

    currentPageId = pageId;
    document.getElementById('pageTitle').textContent = page.title;
    document.getElementById('pageSubtitle').textContent = page.subtitle;
    document.getElementById('pageSelector').value = pageId;

    const wrapper = document.getElementById('imageWrapper');
    // 添加 id="mainImage" 方便后续聚焦操作
    wrapper.innerHTML = `<img src="${page.image}" alt="${page.title}" class="main-image" id="mainImage"
        onerror="this.parentElement.innerHTML='<div class=\\'empty-state\\'>❌ 图片加载失败: ${page.image}<br>请检查 images 文件夹</div>'">`;

    page.hotspots.forEach(hs => {
        const container = document.createElement('div');
        container.className = 'hotspot-container';
        container.style.left = hs.x + '%';
        container.style.top = hs.y + '%';

        // 发光星号标注点
        const dot = document.createElement('div');
        dot.className = 'hotspot';
        dot.innerHTML = '';

        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.innerHTML = `
            <div class="tip-row-1">
                <span class="tip-en">${hs.en}</span>
            </div>
            <div class="tip-phonetic-row">
                <span class="tip-phonetic">${hs.phonetic || ''}</span>
                <button class="speak-btn us" title="美式发音" data-text="${hs.en}" data-lang="en-US">${SpeakerIcon}</button>
                <button class="speak-btn uk" title="英式发音" data-text="${hs.en}" data-lang="en-GB">${SpeakerIcon}</button>
            </div>
            <div class="tip-cn">${hs.cn || ''}</div>
            <div class="tip-example">
                <div class="en-sentence">"${hs.example || 'No example available.'}"</div>
                <div class="cn-sentence">${hs.exampleCN || ''}</div>
            </div>
        `;

        // 事件绑定
        container.addEventListener('mouseenter', () => showTooltip(tooltip, dot));
        container.addEventListener('mouseleave', () => scheduleHide(tooltip, dot));

        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            if (tooltip.classList.contains('show')) {
                tooltip.classList.remove('show', 'tooltip-left');
                dot.classList.remove('active');
                container.style.zIndex = '';
                activeTooltip = null;
            } else {
                showTooltip(tooltip, dot);
            }
        });

        // 发音按钮防冒泡
        tooltip.querySelectorAll('.speak-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                speak(btn.dataset.text, btn.dataset.lang, btn);
            });
            btn.addEventListener('mousedown', (e) => e.stopPropagation());
        });
        tooltip.addEventListener('click', (e) => e.stopPropagation());
        tooltip.addEventListener('mousedown', (e) => e.stopPropagation());

        container.appendChild(dot);
        container.appendChild(tooltip);
        wrapper.appendChild(container);
    });

    renderVocabList(page.hotspots);
}

// ==================== 渲染词汇列表（含填空模式 + 图片聚焦 + 互斥逻辑） ====================
// ==================== 渲染词汇列表（含填空模式 + 图片聚焦 + 发音功能） ====================
function renderVocabList(hotspots) {
    const list = document.getElementById('vocabList');
    // 核心修改：只清除单词项，保留“一键还原”按钮
    list.querySelectorAll('.vocab-item, .reset-mastered-btn').forEach(el => el.remove());
    
    // 默认开启填空模式
    let isQuizMode = true; 
    const revealedItems = new Set();
    
    const modeBtn = document.getElementById('modeToggleBtn');
    
    function updateModeBtn() {
        // 1. 定义 SVG 图标 (使用 currentColor 自动继承文字颜色，尺寸缩小到 16px 更协调)
        const listIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/></svg>`;
        
        const quizIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M12 17h.01"/><path d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/></svg>`;

        // 2. 根据模式切换按钮内容和样式
        if (isQuizMode) {
            // 列表模式：白底，灰色文字和图标
            modeBtn.innerHTML = listIcon + '列表模式';
            modeBtn.style.background = 'white';
            modeBtn.style.color = 'var(--text-secondary)'; // 图标会自动变成这个灰色
            modeBtn.style.borderColor = 'var(--border-light)';
        } else {
            // 填空模式：陶土红底，白色文字和图标
            modeBtn.innerHTML = quizIcon + '填空模式';
            modeBtn.style.background = 'var(--primary-color)';
            modeBtn.style.color = 'white'; // 图标会自动变成白色
            modeBtn.style.borderColor = 'var(--primary-color)';
        }
    }   
    
    updateModeBtn();

    modeBtn.onclick = () => {
        isQuizMode = !isQuizMode;
        updateModeBtn();
        renderItems();
    };

    function updateHotspotHighlight(activeIndex) {
        const containers = document.querySelectorAll('.hotspot-container');
        containers.forEach((container, idx) => {
            const dot = container.querySelector('.hotspot');
            if (idx === activeIndex) {
                dot.classList.add('highlighted');
            } else {
                dot.classList.remove('highlighted');
            }
        });
    }

    function renderItems() {
        // 核心修改：只清除单词项，不删除顶部的“一键还原”按钮
        list.querySelectorAll('.vocab-item').forEach(el => el.remove());
        
        
        hotspots.forEach((hs, index) => {
            const item = document.createElement('div');
            
            if (isQuizMode) {
                item.className = 'vocab-item quiz-mode';
                const isRevealed = revealedItems.has(hs.id);
                if (isRevealed) item.classList.add('revealed');
                
                // 新增：在 quiz-content 中加入了 quiz-phonetic-row
                item.innerHTML = `
                    <div class="quiz-header">
                        <span class="quiz-en">${hs.en}</span>
                        <button class="quiz-reveal-btn ${isRevealed ? 'revealed-state' : 'hidden-state'}">
                            ${isRevealed ? '✓' : '?'}
                        </button>
                    </div>
                    <div class="quiz-content ${isRevealed ? 'show' : ''}">
                        <div class="quiz-phonetic-row">
                            <span class="quiz-phonetic">${hs.phonetic || ''}</span>
                            <button class="speak-btn us" data-text="${hs.en}" data-lang="en-US">${SpeakerIcon}</button>
                            <button class="speak-btn uk" data-text="${hs.en}" data-lang="en-GB">${SpeakerIcon}</button>
                        </div>
                        <div class="quiz-cn">${hs.cn || '暂无翻译'}</div>
                        <div class="quiz-example">
                            "${hs.example || 'No example'}"
                            <div style="font-style:normal; margin-top:2px;">${hs.exampleCN || ''}</div>
                        </div>
                    </div>
                `;
                
                // 绑定发音按钮事件
                item.querySelectorAll('.speak-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        speak(btn.dataset.text, btn.dataset.lang, btn);
                    });
                });

                const btn = item.querySelector('.quiz-reveal-btn');
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const wrapper = document.getElementById('imageWrapper');
                    const mainImg = document.getElementById('mainImage');
                    
                    if (revealedItems.has(hs.id)) {
                        revealedItems.delete(hs.id);
                        if (wrapper) wrapper.classList.remove('is-focused');
                        if (mainImg) {
                            mainImg.classList.remove('focused');
                            setTimeout(() => {
                                if (!mainImg.classList.contains('focused')) {
                                    mainImg.style.transformOrigin = 'center center';
                                }
                            }, 600);
                        }
                        updateHotspotHighlight(-1);
                        renderItems();
                    } else {
                        revealedItems.clear();
                        revealedItems.add(hs.id);
                        renderItems();
                        if (wrapper) wrapper.classList.add('is-focused');
                        if (mainImg) {
                            mainImg.style.transformOrigin = `${hs.x}% ${hs.y}%`;
                            requestAnimationFrame(() => {
                                mainImg.classList.add('focused');
                            });
                        }
                        updateHotspotHighlight(index);
                    }
                });
                
                    } else {
                        // 列表模式
                        const isMastered = masteredWords.has(hs.id);
                        
                        item.className = 'vocab-item';
                        item.innerHTML = `
                            <div class="todo-box ${isMastered ? 'checked' : ''}" data-id="${hs.id}">
                                ${isMastered ? '✓' : ''}
                            </div>
                            <div class="vocab-dot"></div>
                            <div class="vocab-info">
                                <div class="vocab-en ${isMastered ? 'mastered-text' : ''}">${hs.en}</div>
                                <!-- 核心修改：根据 isMastered 状态添加 visible 类 -->
                                <div class="vocab-cn ${isMastered ? 'visible' : ''}">${hs.cn || ''}</div>
                            </div>
                        `;
                        
                        // 1. 绑定 Todo 框的点击事件
                        const todoBox = item.querySelector('.todo-box');
                        const cnDiv = item.querySelector('.vocab-cn');
                        const enDiv = item.querySelector('.vocab-en');

                        todoBox.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            
                            if (masteredWords.has(hs.id)) {
                                // 取消掌握：移除打勾、删除线，隐藏中文
                                masteredWords.delete(hs.id);
                                todoBox.classList.remove('checked');
                                todoBox.innerHTML = '';
                                enDiv.classList.remove('mastered-text');
                                cnDiv.classList.remove('visible'); // 👈 隐藏中文
                            } else {
                                // 标记掌握：打勾、加删除线，显示中文
                                masteredWords.add(hs.id);
                                todoBox.classList.add('checked');
                                todoBox.innerHTML = '✓';
                                enDiv.classList.add('mastered-text');
                                cnDiv.classList.add('visible'); // 👈 显示中文
                            }
                            saveMasteredWords();
                        });

                        // 2. 绑定单词其他区域的点击事件 (触发图片聚焦)
                        item.addEventListener('click', () => {
                            const containers = document.querySelectorAll('.hotspot-container');
                            if (containers[index]) {
                                const dot = containers[index].querySelector('.hotspot');
                                const tooltip = containers[index].querySelector('.tooltip');
                                showTooltip(tooltip, dot);
                            }
                        });
                    }
            
            list.appendChild(item);
        });
    }

    renderItems();
}

// ==================== 分类筛选 ====================
function filterCategory(catKey) {
    currentCategory = catKey;
    document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === catKey);
    });

    const filtered = catKey === 'all' ? appData.pages : appData.pages.filter(p => p.category === catKey);
    const selector = document.getElementById('pageSelector');
    selector.innerHTML = '';
    filtered.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.title;
        selector.appendChild(opt);
    });

    if (filtered.length > 0) {
        renderPage(filtered[0].id);
    } else {
        document.getElementById('imageWrapper').innerHTML = '<div class="empty-state">该分类下暂无页面</div>';
        document.getElementById('vocabList').innerHTML = '';
    }
}

// ==================== 初始化 ====================
async function init() {
    console.log('开始初始化...');
    try {
        console.log('正在请求 data/pages.json ...');
        const resp = await fetch('data/pages.json');
        if (!resp.ok) throw new Error(`HTTP 错误! 状态码: ${resp.status} (请确保使用了本地服务器)`);
        
        appData = await resp.json();
        console.log('JSON 加载成功!', appData);

        // 渲染分类
        const catBar = document.getElementById('categoryBar');
        catBar.innerHTML = ''; // 清空旧按钮
        
        // 1. 为“全部”按钮准备一个 Lucide SVG 图标 (Layout Grid 网格图标)
        const allIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`;

        const allBtn = document.createElement('button');
        allBtn.className = 'cat-btn active';
        allBtn.dataset.cat = 'all';
        // 👇 修改这里：使用 innerHTML 拼接图标和文字
        allBtn.innerHTML = allIcon + ' 全部'; 
        allBtn.addEventListener('click', () => filterCategory('all'));
        catBar.appendChild(allBtn);

        appData.categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'cat-btn';
            btn.dataset.cat = cat.key;
            
            // 👇 核心修改：使用 innerHTML 读取 JSON 里的 icon 字段，并加上容错处理
            btn.innerHTML = (cat.icon || '') + ' ' + cat.label; 
            
            btn.addEventListener('click', () => filterCategory(cat.key));
            catBar.appendChild(btn);
        });

        document.getElementById('pageSelector').addEventListener('change', (e) => renderPage(e.target.value));

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.tooltip') && !e.target.closest('.speak-btn') && !e.target.closest('.hotspot')) {
                if (activeTooltip) {
                    activeTooltip.classList.remove('show', 'tooltip-left');
                    const dot = activeTooltip.closest('.hotspot-container')?.querySelector('.hotspot');
                    if (dot) dot.classList.remove('active');
                    const container = activeTooltip.closest('.hotspot-container');
                    if (container) container.style.zIndex = '';
                    activeTooltip = null;
                }
            }
        });

        filterCategory('all');

            // ==================== 绑定“一键还原”按钮事件 ====================
        document.getElementById('resetMasteredBtn').addEventListener('click', () => {
            if (masteredWords.size === 0) {
                alert('当前没有已掌握的单词，无需还原！');
                return;
            }
            if (confirm(`确定要清空所有 ${masteredWords.size} 个已掌握的单词记录吗？\n（此操作不可撤销）`)) {
                masteredWords.clear();
                saveMasteredWords();
                
                // 重新渲染当前页面的词汇列表，刷新 UI 状态
                if (currentPageId) {
                    const page = appData.pages.find(p => p.id === currentPageId);
                    if (page) renderVocabList(page.hotspots);
                }
            }
        });

    } catch (err) {
        console.error('初始化失败:', err);
        document.getElementById('imageWrapper').innerHTML = `
            <div class="empty-state">
                <p>❌ 加载失败: ${err.message}</p>
                <p style="margin-top:8px;font-size:13px;color:#94a3b8">
                    请按 F12 打开控制台查看详细错误。<br>
                    如果是 CORS 错误，请使用本地服务器：<br>
                    <code>python -m http.server 8000</code>
                </p>
            </div>
        `;
    }
}

// ==================== 导出高清海报功能 ====================
document.getElementById('exportPosterBtn').addEventListener('click', async () => {
    if (!currentPageId) return alert('请先选择一个页面！');
    
    const page = appData.pages.find(p => p.id === currentPageId);
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const appMain = document.querySelector('.app-main');
    const vocabList = document.querySelector('.vocab-list');
    const sidebar = document.querySelector('.sidebar');
    const pageCard = document.querySelector('.page-card');
    
    // 1. 动态插入海报标题栏（只在外面插入一次）
    const titleBar = document.createElement('div');
    titleBar.className = 'poster-title-bar';
    titleBar.innerHTML = `<h2>${page.title}</h2><p>${today} | 图解英语 Interactive Learning</p>`;
    appMain.insertBefore(titleBar, appMain.firstChild);
    
    try {
        const btn = document.getElementById('exportPosterBtn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '生成中...';
        btn.disabled = true;

        // 2. 核心修复：改为垂直布局并强制统一宽度
        appMain.style.display = 'flex';
        appMain.style.flexDirection = 'column';
        appMain.style.gap = '30px';
        appMain.style.alignItems = 'center'; // 关键：让所有子元素水平居中
        
        // 设定一个统一的海报宽度 (例如 900px)，确保图片和词汇表完全对齐
        const posterWidth = '900px'; 

        if (pageCard) { 
            pageCard.style.width = posterWidth; 
            pageCard.style.maxWidth = '100%'; // 防止小屏幕溢出
            pageCard.style.margin = '0 auto'; // 居中
        }
        if (sidebar) { 
            sidebar.style.width = posterWidth; 
            sidebar.style.maxWidth = '100%';
            sidebar.style.position = 'static'; 
            sidebar.style.margin = '0 auto'; // 居中
        }
        
        // 确保图片填满卡片
        const mainImg = document.querySelector('.main-image');
        if (mainImg) {
            mainImg.style.width = '100%';
            mainImg.style.height = 'auto';
        }

        // 3. 临时放大标题栏字体
        if (titleBar) {
            titleBar.querySelector('h2').style.fontSize = '36px';
            titleBar.querySelector('p').style.fontSize = '18px';
            titleBar.style.width = posterWidth; // 标题栏也统一宽度
            titleBar.style.maxWidth = '100%';
        }

        // 4. 临时展开词汇表并放大字体
        const originalMaxHeight = vocabList.style.maxHeight;
        vocabList.style.maxHeight = 'none'; 
        vocabList.style.overflow = 'visible';
        
        vocabList.querySelectorAll('.vocab-en').forEach(el => el.style.fontSize = '20px');
        vocabList.querySelectorAll('.vocab-cn').forEach(el => { 
            el.style.fontSize = '16px'; 
            el.style.maxHeight = '100px';
            el.classList.add('visible'); 
        });
        
        if (activeTooltip) { activeTooltip.classList.remove('show'); activeTooltip = null; }

        await new Promise(resolve => setTimeout(resolve, 300));

        btn.innerHTML = originalText;
        btn.disabled = false;
        await new Promise(resolve => setTimeout(resolve, 50));

        const canvas = await html2canvas(appMain, {
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff', 
            logging: false,
            windowWidth: appMain.scrollWidth,
            windowHeight: appMain.scrollHeight,
            x: 0, y: 0
        });

        const link = document.createElement('a');
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `Poster_${page.id}_${dateStr}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        
    } catch (err) {
        console.error('海报导出失败:', err);
        alert('导出失败！请确保使用本地服务器 (如 Live Server) 打开网页。');
    } finally {
        // 恢复原状
        titleBar.remove(); // 直接删除外面声明的 titleBar
        
        appMain.style.display = ''; 
        appMain.style.flexDirection = ''; 
        appMain.style.gap = ''; 
        appMain.style.alignItems = '';
        
        if (pageCard) { 
            pageCard.style.width = ''; 
            pageCard.style.maxWidth = ''; 
            pageCard.style.margin = ''; 
        }
        if (sidebar) { 
            sidebar.style.width = ''; 
            sidebar.style.maxWidth = ''; 
            sidebar.style.position = ''; 
            sidebar.style.margin = ''; 
        }
        
        vocabList.style.maxHeight = ''; 
        vocabList.style.overflow = ''; 
        
        vocabList.querySelectorAll('.vocab-en').forEach(el => el.style.fontSize = '');
        vocabList.querySelectorAll('.vocab-cn').forEach(el => { 
            el.style.fontSize = ''; 
            el.style.maxHeight = '';
            el.classList.remove('visible');
        });
        
        const btn = document.getElementById('exportPosterBtn');
        if (btn.disabled) {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 海报`;
            btn.disabled = false;
        }
    }
});
document.addEventListener('DOMContentLoaded', init);