let relations = JSON.parse(localStorage.getItem('relations')) || { companies: [], clients: [] }; // 全局初始化，从 localStorage 安全加载
let tasks = [];
let score = 0;
let weeklyScores = JSON.parse(localStorage.getItem('weeklyScores')) || [];
let tags = JSON.parse(localStorage.getItem('tags')) || [];

// 加载数据从LocalStorage
function loadData() {
    relations = { companies: [], clients: [] }; // 先重置
    loadTags();
    const saved = localStorage.getItem('relations');
    if (saved) {
        try {
            relations = JSON.parse(saved);
            console.log('加载数据:', relations);
            // 确保每个项有 addedDate 和 lastContactDate
            [...relations.companies, ...relations.clients].forEach(item => {
                if (!item.addedDate) item.addedDate = new Date().toLocaleDateString();
                if (!item.lastContactDate) item.lastContactDate = new Date().toISOString().split('T')[0];
                // 初始化公司/客户自定义字段
                item.months1 = item.months1 || '否';
                item.months2 = item.months2 || '否';
                item.months3 = item.months3 || '否';
                item.survey = item.survey || '否';
                item.report = item.report || '否';
                item.strategy = item.strategy || '否';
                item.roadshow = item.roadshow || '否';
                item.title = item.title || 'IR';
            });
        } catch (e) {
            console.error('JSON解析错误:', e);
            alert('数据加载失败，已重置！');
        }
    }
    renderLists();
    renderTodoList();
    generateWeeklyTodos();
    drawChart();
    initKChart();
    populateKeyContacts();
    initCalendar();
    updateStats();
    populateTagSelects();
}

// 保存数据
function saveData() {
    localStorage.setItem('relations', JSON.stringify(relations));
}

function loadTags() {
    try {
        tags = JSON.parse(localStorage.getItem('tags')) || [];
    } catch (e) {
        console.warn('加载标签失败，重置', e);
        tags = [];
    }
}

function saveTags() {
    localStorage.setItem('tags', JSON.stringify(tags));
}

function populateTagSelects() {
    const selects = document.querySelectorAll('select[id$="Tags"]');
    selects.forEach(select => {
        // remember selected values
        const prev = Array.from(select.selectedOptions).map(o => o.value);
        select.innerHTML = '';
        tags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag.name;
            option.text = tag.name;
            if (prev.includes(tag.name)) option.selected = true;
            select.appendChild(option);
        });
    });
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

// 显示切换
function showSection(section) {
    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    document.getElementById(section).style.display = 'block';
}

// 打开添加弹窗
let currentType, currentIndex = -1;
function addRelation(type) {
    currentType = type;
    currentIndex = -1;
    document.getElementById('type').innerText = type === 'company' ? '上市公司' : '买方客户';
    document.getElementById('name').value = '';
    document.getElementById('importance').value = '3';
    document.getElementById('quality').value = 'C';
    document.getElementById('tags').value = '';
    document.getElementById('modal').style.display = 'block';
}

// 保存关系
function saveRelation(type) {
    const name = document.getElementById('name').value;
    const importance = document.getElementById('importance').value;
    const quality = document.getElementById('quality').value;
    // support modal tags select or comma-separated input
    let tagsSelected = [];
    const tagsEl = document.getElementById('tags');
    if (tagsEl) {
        if (tagsEl.selectedOptions) tagsSelected = Array.from(tagsEl.selectedOptions).map(o => o.value);
        else tagsSelected = tagsEl.value ? tagsEl.value.split(',') : [];
    }
    
    const code = document.getElementById('code').value;
    const position = document.getElementById('position').value;
    const contact = document.getElementById('contact').value;
    const relation = {
        id: generateId(),
        name,
        code,
        position,
        contact,
        type: currentType,
        importance: parseInt(importance),
        quality,
        tags: tagsSelected,
        // 最后互动完整时间戳
        lastInteraction: new Date().toISOString(),
        // 新增字段：是否冻结（默认 false），关系规模（small/large），以及上次联系日期（用于简化日历/任务判断）
        isFrozen: false,
        relationSize: 'small',
        lastContactDate: (document.getElementById('lastContact') && document.getElementById('lastContact').value) ? document.getElementById('lastContact').value : new Date().toISOString().split('T')[0],
        addedDate: currentIndex === -1 ? new Date().toLocaleDateString() : relations[type === 'company' ? 'companies' : 'clients'][currentIndex].addedDate,
        interactions: [],
        months1: '否',
        months2: '否',
        months3: '否',
        survey: '否',
        report: '否',
        strategy: '否',
        roadshow: '否',
        title: 'IR'
    };

    // 支持传入 type（'companies' 或 'clients'）或使用 currentType ('company'/'client') 的简化映射
    let typeKey = type;
    if (!typeKey) {
        typeKey = currentType === 'company' ? 'companies' : 'clients';
    }
    // 如果传入的是单数如 'company'/'client'，做映射
    if (typeKey === 'company') typeKey = 'companies';
    if (typeKey === 'client') typeKey = 'clients';

    if (!relations[typeKey]) {
        relations[typeKey] = [];
    }

    // 如果是新增，currentIndex 表示编辑项索引；若为新增则 currentIndex === -1
    if (currentIndex === -1) {
        relations[typeKey].push(relation);
        // update tag associations
        (relation.tags || []).forEach(tn => {
            const t = tags.find(x => x.name === tn);
            if (t) {
                t.associatedItems = t.associatedItems || [];
                if (!t.associatedItems.includes(relation.id)) t.associatedItems.push(relation.id);
            }
        });
        saveTags();
    } else {
        relations[typeKey][currentIndex] = relation;
    }

    saveData();
    renderLists();
    closeModal();
    generateWeeklyTodos();
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 渲染列表（替换 displayLists 和 displayList）
function renderLists() {
    const clientTbody = document.getElementById('clientTable').querySelector('tbody');
    clientTbody.innerHTML = '';
    relations.clients.forEach((client, index) => {
        const now = new Date();
        const last = new Date(client.lastContactDate);
        let months1 = (now - last) / (1000*60*60*24*30) < 1 ? '是' : '否';
        let months2 = (now - last) / (1000*60*60*24*30) < 2 ? '是' : '否';
        const latest = client.lastInteraction ? `${new Date(client.lastInteraction).toLocaleDateString()} (${client.interactions.at(-1)?.type || '/'})` : '/';
        const clientTags = (client.tags || []).map(tagName => {
            const tObj = tags.find(tt => tt.name === tagName);
            const color = (tObj && tObj.color) ? tObj.color : tagColor(tagName);
            return `<span class="tag" style="background:${color}">${tagName}</span>`;
        }).join(' ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${client.code || ''}</td>
            <td>${client.name}</td>
            <td>${clientTags}</td>
            <td>${client.importance} [5最高-1最低]</td>
            <td>${client.quality}</td>
            <td><select onchange="updateSelect('clients', ${index}, 'months1', this.value)"><option ${months1==='是'?'selected':''}>是</option><option ${months1==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('clients', ${index}, 'months2', this.value)"><option ${months2==='是'?'selected':''}>是</option><option ${months2==='否'?'selected':''}>否</option></select></td>
            <td>${latest}</td>
            <td><button onclick="editItem('clients', ${index})">编辑</button> <button class="delete" onclick="deleteItem('clients', ${index})">删除</button></td>
        `;
        clientTbody.appendChild(tr);
    });

    const companyTbody = document.getElementById('companyTable').querySelector('tbody');
    companyTbody.innerHTML = '';
    relations.companies.forEach((company, index) => {
        const now = new Date();
        const last = new Date(company.lastContactDate);
        let months1 = (now - last) / (1000*60*60*24*30) < 1 ? '是' : '否';
        let months2 = (now - last) / (1000*60*60*24*30) < 2 ? '是' : '否';
        let months3 = (now - last) / (1000*60*60*24*30) < 3 ? '是' : '否';
        const companyTags = (company.tags || []).map(tagName => {
            const tObj = tags.find(tt => tt.name === tagName);
            const color = (tObj && tObj.color) ? tObj.color : tagColor(tagName);
            return `<span class="tag" style="background:${color}">${tagName}</span>`;
        }).join(' ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${company.name}</td>
            <td>${company.position || ''}</td>
            <td><select onchange="updateSelect('companies', ${index}, 'title', this.value)"><option ${company.title==='正代董秘'?'selected':''}>正代董秘</option><option ${company.title==='IR'?'selected':''}>IR</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'months1', this.value)"><option ${months1==='是'?'selected':''}>是</option><option ${months1==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'months2', this.value)"><option ${months2==='是'?'selected':''}>是</option><option ${months2==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'months3', this.value)"><option ${months3==='是'?'selected':''}>是</option><option ${months3==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'survey', this.value)"><option ${company.survey==='是'?'selected':''}>是</option><option ${company.survey==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'report', this.value)"><option ${company.report==='是'?'selected':''}>是</option><option ${company.report==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'strategy', this.value)"><option ${company.strategy==='是'?'selected':''}>是</option><option ${company.strategy==='否'?'selected':''}>否</option></select></td>
            <td><select onchange="updateSelect('companies', ${index}, 'roadshow', this.value)"><option ${company.roadshow==='是'?'selected':''}>是</option><option ${company.roadshow==='否'?'selected':''}>否</option></select></td>
            <td><button onclick="editItem('companies', ${index})">编辑</button> <button class="delete" onclick="deleteItem('companies', ${index})">删除</button></td>
        `;
        companyTbody.appendChild(tr);
    });
}

// 删除项（新增）
function deleteItem(type, index) {
    if (confirm('确认删除?')) {
        const item = relations[type][index];
        // remove from tag associations
        (item.tags || []).forEach(tn => {
            const t = tags.find(x => x.name === tn);
            if (t && t.associatedItems) {
                t.associatedItems = t.associatedItems.filter(id => id !== item.id);
            }
        });
        saveTags();
        relations[type].splice(index, 1);
        saveData();
        renderLists();
        updateStats();
    }
}

// 编辑项（新增，打开编辑模态）
function editItem(type, index) {
    const editType = type === 'clients' ? 'client' : 'company';
    editRelation(editType, index);
}

// 编辑
function editRelation(type, index) {
    currentType = type;
    currentIndex = index;
    const list = type === 'company' ? relations.companies : relations.clients;
    const item = list[index];
    // 预填编辑模态字段
    document.getElementById('editType').value = type === 'company' ? 'companies' : 'clients';
    document.getElementById('editIndex').value = index;
    document.getElementById('editName').value = item.name;
    document.getElementById('editImportance').value = item.importance;
    document.getElementById('editQuality').value = item.quality;
    document.getElementById('editCode').value = item.code || '';
    document.getElementById('editPosition').value = item.position || '';
    document.getElementById('editContact').value = item.contact || '';
    document.getElementById('editLastContact').value = item.lastContactDate || '';
    // 预选标签
    const editTagsSelect = document.getElementById('editTags');
    populateTagSelects(); // 刷新下拉
    Array.from(editTagsSelect.options).forEach(opt => {
        opt.selected = item.tags.includes(opt.value);
    });
    document.getElementById('editModal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

function saveEdit() {
    const type = document.getElementById('editType').value;
    const index = parseInt(document.getElementById('editIndex').value);
    const item = relations[type][index];
    item.name = document.getElementById('editName').value;
    item.importance = document.getElementById('editImportance').value;
    item.quality = document.getElementById('editQuality').value;
    item.code = document.getElementById('editCode').value;
    item.position = document.getElementById('editPosition').value;
    item.contact = document.getElementById('editContact').value;
    item.lastContactDate = document.getElementById('editLastContact').value || item.lastContactDate;
    item.tags = Array.from(document.getElementById('editTags').selectedOptions).map(o => o.value);
    // update tag associations (remove old, add new)
    tags.forEach(t => {
        t.associatedItems = t.associatedItems.filter(id => id !== item.id);
    });
    item.tags.forEach(tn => {
        const t = tags.find(x => x.name === tn);
        if (t) {
            if (!t.associatedItems.includes(item.id)) t.associatedItems.push(item.id);
        }
    });
    saveTags();
    saveData();
    renderLists();
    closeEditModal();
}

// 加载时运行
window.onload = loadData;

// 记录互动
function recordInteraction(type, index) {
    const interactionType = prompt('互动类型: 发消息/打电话/路演');
    const note = prompt('互动摘要:');
    const feedback = prompt('反馈结果: 正向/中性/负向');
    const list = type === 'company' ? relations.companies : relations.clients;
    list[index].interactions.push({ date: new Date().toISOString(), type: interactionType, note, feedback });
    list[index].lastInteraction = new Date().toISOString();
    list[index].lastContactDate = new Date().toISOString().split('T')[0]; // 更新最后联系日期
    // 根据反馈调整quality
    const qualityLevels = ['S', 'A', 'B', 'C', 'D', 'E'];
    let currentIdx = qualityLevels.indexOf(list[index].quality);
    if (feedback === '正向') {
        currentIdx = Math.max(0, currentIdx - 1); // 提升1级
    } else if (feedback === '负向') {
        currentIdx = Math.min(5, currentIdx + 1); // 降低1级
    }
    list[index].quality = qualityLevels[currentIdx];
    saveData();
    renderLists();
    generateWeeklyTodos();
    updateCalendarEvents();
    // 依据动作类型和重要度更新得分
    updateScore(interactionType, list[index].importance);
}

// 生成任务（替换 generateTasksOld）
function generateWeeklyTasks() {
    tasks = [];
    const taskList = document.getElementById('taskList');
    if (taskList) taskList.innerHTML = '';

    const now = new Date().toISOString().split('T')[0];
    const allRelations = [...relations.companies, ...relations.clients];
    allRelations.forEach((item) => {
        const urgency = calculateUrgency(item); // 使用新 urgency 计算
        if (urgency > 10) {
            tasks.push({ name: item.name, suggestion: urgency > 60 ? '路演' : (urgency > 30 ? '打电话' : '发消息'), urgency, daysSince: daysBetween(item.lastContactDate, now), completed: false, type: 'auto', reward: 0 });
        }
    });
    tasks.sort((a, b) => b.urgency - a.urgency);
    tasks = tasks.slice(0, 20); // Top 20
    displayTasks();
    populateCalendar();
    updateCalendarEvents(); // 更新日历
}

function displayTasks() {
    const ul = document.getElementById('taskList');
    ul.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        let color = 'black';
        if (task.urgency > 100) color = '#e74c3c'; // 红色
        else if (task.urgency > 50) color = 'orange'; // 橙色
        else color = 'green'; // 绿色
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask(this, ${index})">
            <span style="color: ${color};">${task.type === 'manual' ? '[手动]' : '[自动]'} 联系 ${task.name}: ${task.suggestion} (距上次${Math.floor(task.daysSince)}天, 紧迫度: ${task.urgency.toFixed(2)}, 奖励: ${task.reward})</span>
        `;
        ul.appendChild(li);
    });
    // 同步到详细待办列表
    renderTodoList();
    updateTaskProgress(); // 更新进度
}

// 周得分
function updateScore(actionType, importance) {
    let basePoints = 0;
    if (actionType === '发消息') basePoints = 5;
    else if (actionType === '打电话') basePoints = 10;
    else if (actionType === '路演') basePoints = 30;
    let multiplier = 1;
    if (importance === 5) multiplier = 2.0; // 最高优先
    else if (importance <= 2) multiplier = 0.5; // 最低减半
    // 重要度3-4默认乘以1
    score += basePoints * multiplier;
    document.getElementById('score').innerText = Math.floor(score);
    if (score >= 100) alert('本周目标达成！去喝一杯奖励自己吧！');
}

// 每周重置得分（可被定时调用）
function resetScore() {
    // 记录本周得分到周历史并限制为最近4周
    weeklyScores.push(score);
    if (weeklyScores.length > 4) weeklyScores.shift();
    localStorage.setItem('weeklyScores', JSON.stringify(weeklyScores));
    // 重置本周得分
    score = 0;
    document.getElementById('score').innerText = Math.floor(score);
    drawChart();
}

// 添加手动任务（更新为备忘录格式，支持奖励）
function addTaskPrompt() {
    const name = prompt('任务目标名称 (例如: 张三 或 手动备忘: 会议)');
    if (!name) return;
    const suggestion = prompt('建议行动 (发消息/打电话/路演/其他)', '其他');
    const reward = parseInt(prompt('设置奖励分 (1-20)', '10')) || 10;
    tasks.unshift({ name, suggestion, urgency: 0, daysSince: 0, completed: false, type: 'manual', reward: Math.min(20, Math.max(1, reward)) });
    displayTasks();
    populateCalendar();
}

// 导出数据
function exportData() {
    const data = JSON.stringify(relations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'relations.json';
    a.click();
    URL.revokeObjectURL(url);
}

// 快速添加表单保存（修改为调用 addClient/addCompany）
function quickAddSave() {
    const type = document.getElementById('addType').value;
    if (type === 'companies') {
        addCompany();
    } else {
        addClient();
    }
    updateStats();
}

// 添加客户（新增，从添加区域）
function addClient() {
    const client = {
        id: generateId(),
        name: document.getElementById('clientName').value,
        importance: document.getElementById('clientImportance').value,
        quality: document.getElementById('clientQuality').value,
        code: document.getElementById('clientCode').value,
        position: document.getElementById('clientPosition').value,
        contact: document.getElementById('clientContact').value,
        tags: Array.from((document.getElementById('clientTags') || {}).selectedOptions || []).map(o => o.value),
        addedDate: new Date().toLocaleDateString(),
        lastContactDate: (document.getElementById('clientLastContact') && document.getElementById('clientLastContact').value) ? document.getElementById('clientLastContact').value : new Date().toISOString().split('T')[0],
        interactions: [],
        months1: '否',
        months2: '否',
        latest: '/'
    };
    relations.clients.push(client);
    // update tag associations
    (client.tags || []).forEach(tn => {
        const t = tags.find(x => x.name === tn);
        if (t) {
            t.associatedItems = t.associatedItems || [];
            if (!t.associatedItems.includes(client.id)) t.associatedItems.push(client.id);
        }
    });
    saveTags();
    saveData();
    renderLists();
    clearAddForms();
}

// 添加公司（新增，从添加区域）
function addCompany() {
    const company = {
        id: generateId(),
        name: document.getElementById('companyName').value,
        importance: document.getElementById('companyImportance').value,
        quality: document.getElementById('companyQuality').value,
        code: document.getElementById('companyCode').value,
        position: document.getElementById('companyPosition').value,
        contact: document.getElementById('companyContact').value,
        tags: Array.from((document.getElementById('companyTags') || {}).selectedOptions || []).map(o => o.value),
        addedDate: new Date().toLocaleDateString(),
        lastContactDate: (document.getElementById('companyLastContact') && document.getElementById('companyLastContact').value) ? document.getElementById('companyLastContact').value : new Date().toISOString().split('T')[0],
        interactions: [],
        months1: '否',
        months2: '否',
        months3: '否',
        survey: '否',
        report: '否',
        strategy: '否',
        roadshow: '否',
        title: 'IR'
    };
    relations.companies.push(company);
    // update tag associations
    (company.tags || []).forEach(tn => {
        const t = tags.find(x => x.name === tn);
        if (t) {
            t.associatedItems = t.associatedItems || [];
            if (!t.associatedItems.includes(company.id)) t.associatedItems.push(company.id);
        }
    });
    saveTags();
    saveData();
    renderLists();
    clearAddForms();
}

// 清空添加表单（新增）
function clearAddForms() {
    document.querySelectorAll('.add-form input, .add-form select').forEach(el => el.value = '');
}

// 更新统计并绘制饼图
function updateStats() {
    const companies = (relations.companies || []).length;
    const clients = (relations.clients || []).length;
    document.getElementById('countCompanies').innerText = companies;
    document.getElementById('countClients').innerText = clients;
    const ctx = document.getElementById('statsChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    if (window._statsChart) window._statsChart.destroy();
    try {
        window._statsChart = new Chart(context, {
            type: 'pie',
            data: { labels: ['公司', '客户'], datasets: [{ data: [companies, clients], backgroundColor: ['#4e79a7', '#f28e2b'] }] }
        });
    } catch (e) {
        console.warn('无法绘制统计图', e);
    }
}

function drawChart() {
    const ctx = document.getElementById('scoreChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    // Destroy existing chart instance if any (attach to canvas)
    if (window._scoreChartInstance) {
        window._scoreChartInstance.destroy();
    }
    // 注释掉 Chart.js 的实际创建代码（库已被注释掉）
    // window._scoreChartInstance = new Chart(context, {
    //     type: 'line',
    //     data: { labels: ['周1', '周2', '周3', '周4'], datasets: [{ label: '勤奋指数', data: weeklyScores, borderColor: 'blue', fill: false }] },
    //     options: { scales: { y: { beginAtZero: true } } }
    // });
}

// 查看历史
function viewHistory(type, index) {
    const list = type === 'company' ? relations.companies : relations.clients;
    const item = list[index];
    document.getElementById('historyTitle').innerText = `${item.name} 的互动历史`;
    const ul = document.getElementById('historyList');
    ul.innerHTML = '';
    item.interactions.forEach(inter => {
        const li = document.createElement('li');
        li.innerText = `${inter.date} - 类型: ${inter.type} - 摘要: ${inter.note} - 反馈: ${inter.feedback}`;
        ul.appendChild(li);
    });
    if (item.interactions.length === 0) {
        ul.innerHTML = '<li>暂无互动记录</li>';
    }
    document.getElementById('historyModal').style.display = 'block';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// 初始化 K 线图（基于 interactions 生成模拟 OHLC 数据）
function initKChart(rangeDays = 14) {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    // 使用传入的 rangeDays 作为天数范围，默认最近 rangeDays 天
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - rangeDays + 1);
    // 初始化每日得分（默认0）
    const dayScores = {};
    for (let d = 0; d < rangeDays; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + d);
        const key = dt.toISOString().slice(0,10);
        dayScores[key] = 0;
    }
    // 遍历 interactions 更新每日得分（示例：每个互动 +10 分）
    const all = [...(relations.companies || []), ...(relations.clients || [])];
    all.forEach(rel => {
        (rel.interactions || []).forEach(inter => {
            const dateKey = (new Date(inter.date)).toISOString().slice(0,10);
            if (dateKey in dayScores) dayScores[dateKey] += 10;
        });
    });
    // 生成 OHLC 数据（基于每日得分模拟）
    const data = Object.keys(dayScores).map(dateKey => {
        const s = dayScores[dateKey] || 0;
        const open = s + (Math.random() - 0.5) * 2;
        const close = s + (Math.random() - 0.5) * 2;
        const high = Math.max(open, close) + Math.random() * 1;
        const low = Math.min(open, close) - Math.random() * 1;
        return { x: dateKey, o: +open.toFixed(2), h: +high.toFixed(2), l: +low.toFixed(2), c: +close.toFixed(2) };
    });
    // 销毁旧图并绘制
    if (window._kChartInstance) window._kChartInstance.destroy();
    try {
        const ctx = canvas.getContext('2d');
        window._kChartInstance = new Chart(ctx, {
            type: 'candlestick',
            data: { datasets: [{ label: '每天得分趋势', data }] },
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 0 } } } }
        });
    } catch (e) {
        console.warn('无法初始化 K 线图:', e);
    }
}

// 填充本周重点联系人（基于 lastContactDate 在最近 7 天内）
function populateKeyContacts() {
    const container = document.getElementById('contactsContainer');
    if (!container) return;
    container.innerHTML = '';
    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    const clients = relations.clients || [];
    clients.forEach((client, idx) => {
        const last = client.lastContactDate ? new Date(client.lastContactDate) : null;
        if (last && last >= weekAgo) {
            const card = document.createElement('div');
            card.className = 'contact-card';
            const img = document.createElement('img');
            img.src = client.avatar || 'avatar.jpg';
            img.alt = '头像';
            const info = document.createElement('p');
            const lastStr = last ? last.toISOString().slice(0,10) : '无';
            info.innerHTML = `姓名: ${client.name || ''}<br>公司: ${client.code || ''}<br>最后联系: ${lastStr}`;
            const btn = document.createElement('button');
            btn.innerText = '立即联系';
            btn.onclick = () => recordInteraction('client', idx);
            card.appendChild(img);
            card.appendChild(info);
            card.appendChild(btn);
            container.appendChild(card);
        }
    });
}

// FullCalendar 初始化与事件填充
let _calendarInstance = null;
function initCalendar() {
    const el = document.getElementById('calendar-container');
    if (!el) return;
    if (_calendarInstance) {
        try { _calendarInstance.destroy(); } catch (e) {}
        _calendarInstance = null;
    }
    _calendarInstance = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' },
        events: []
    });
    _calendarInstance.render();
    populateCalendar();
}

function populateCalendar() {
    if (!_calendarInstance) return;
    // 生成事件：历史互动（蓝点） + 待办提醒（从 tasks，标红）
    const events = [];
    const all = [...(relations.companies || []), ...(relations.clients || [])];
    all.forEach(rel => {
        (rel.interactions || []).forEach(inter => {
            const d = inter.date ? inter.date.slice(0,10) : null;
            if (d) events.push({ title: `${inter.type}：${rel.name}`, start: d, display: 'background', backgroundColor: '#cfe8ff', borderColor: '#9fd0ff' });
        });
    });
    // 把 tasks 中的提醒显示为日历事件（今日提醒，红色点）
    (tasks || []).forEach(t => {
        const today = new Date().toISOString().slice(0,10);
        events.push({ title: `联系 ${t.name}: ${t.suggestion}`, start: today, color: '#ff6b6b' });
    });
    // 更新日历事件
    try {
        _calendarInstance.removeAllEvents();
        _calendarInstance.addEventSource(events);
    } catch (e) {
        console.error('更新日历事件失败', e);
    }
}

// 更新日历事件（新增，颜色区分）
function updateCalendarEvents() {
    if (!_calendarInstance) return;
    const events = [];
    tasks.forEach(task => {
        const event = {
            title: `联系 ${task.name}: ${task.suggestion}`,
            start: new Date().toISOString().slice(0,10),
            color: task.completed ? '#3498db' : '#e74c3c' // 蓝色已完成，红色未完成
        };
        events.push(event);
    });
    _calendarInstance.removeAllEvents();
    _calendarInstance.addEventSource(events);
    updateTaskProgress(); // 更新进度条
}

// 生成必须完成的任务（基于紧急度和冻结状态）
function generateMandatoryTasks() {
    const mandatory = [];
    for (let client of relations.clients) {
        const urgency = calculateUrgency(client);
        if (urgency >= 100 || client.isFrozen) {
            // 确保 client 有 id
            if (client.id) mandatory.push(client.id);
        }
    }
    return mandatory;
}

// 生成可选任务（可按 tag、top/random 模式选择）
function generateOptionalTasks(options) {
    let candidates = relations.clients.filter(client => 
        !options.tag || (client.tags || []).includes(options.tag)
    );
    
    candidates = candidates.map(client => ({ ...client, urgency: calculateUrgency(client) }));
    
    candidates = candidates.filter(client => client.urgency < 100 && !client.isFrozen);
    
    if (options.mode === 'top') {
        candidates.sort((a, b) => b.urgency - a.urgency);
        return candidates.slice(0, options.count).map(c => c.id);
    } else if (options.mode === 'random') {
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, options.count).map(c => c.id);
    }
    return [];
}

// 每周待办生成器（替换旧的 generateTasks 逻辑接口）
function generateWeeklyTodos(options = null) {
    const mandatoryIds = generateMandatoryTasks();
    let optionalIds = [];
    if (options) {
        if (!confirm('选择后不可改变，不可删除。确认生成可选任务？')) {
            return;
        }
        optionalIds = generateOptionalTasks(options);
    }
    
    const todos = [
        ...mandatoryIds.map(id => ({ clientId: id, isMandatory: true, completed: false })),
        ...optionalIds.map(id => ({ clientId: id, isMandatory: false, completed: false }))
    ];
    
    localStorage.setItem('todos', JSON.stringify(todos));
    localStorage.setItem('penalty', '0');
    renderTodos();
    generateWeeklyTasks(); // 整合生成任务
}
// --- 新增工具函数: daysBetween, calculateUrgency, updateClient ---
function daysBetween(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

function calculateUrgency(client) {
    const today = new Date().toISOString().split('T')[0];
    const daysSinceLast = daysBetween(client.lastContactDate, today);
    const maxDays = (client.relationSize === 'large') ? 30 : 60;
    
    const base = daysSinceLast / maxDays;
    let urgency = Math.pow(base, 1.5) * 100;
    
    urgency = Math.min(200, urgency);
    
    if (urgency > 120 && !client.isFrozen) {
        client.isFrozen = true;
        updateClient(client);
    }
    
    return urgency;
}

function updateClient(updatedClient) {
    const index = relations.clients.findIndex(c => c.id === updatedClient.id);
    if (index !== -1) {
        relations.clients[index] = updatedClient;
        localStorage.setItem('relations', JSON.stringify(relations));
    }
}

function completeTask(clientId) {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    const todo = todos.find(t => t.clientId === clientId);
    if (todo) {
        todo.completed = true;
        const client = relations.clients.find(c => c.id === clientId);
        if (client) {
            client.lastContactDate = new Date().toISOString().split('T')[0];
            if (client.isFrozen) client.isFrozen = false;
            updateClient(client);
        }
        localStorage.setItem('todos', JSON.stringify(todos));
        renderTodos();
        updateCalendarEvents();
        renderLists();
    }
}

function calculatePenalty() {
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    let penalty = parseInt(localStorage.getItem('penalty')) || 0;
    
    const uncompleted = todos.filter(t => !t.completed);
    for (let todo of uncompleted) {
        const client = relations.clients.find(c => c.id === todo.clientId);
        if (!client) continue;
        
        const urgency = calculateUrgency(client);
        let deduct = 5;
        if (client.relationSize === 'large' || urgency >= 100) deduct = 20;
        if (client.isFrozen || urgency > 120) deduct = 30;
        
        penalty += deduct;
    }
    
    localStorage.setItem('penalty', penalty.toString());
    
    if (penalty >= 100) {
        alert('扣分达到100分，本周任务结束！请尽快补齐未完成任务。');
    }
    
    renderTodos();
    return penalty;
}

function renderTodos() {
    const tasksList = document.getElementById('taskList');
    if (!tasksList) return;
    tasksList.innerHTML = '';
    let todos = JSON.parse(localStorage.getItem('todos')) || [];
    
    todos.forEach(todo => {
        const client = relations.clients.find(c => c.id === todo.clientId);
        if (!client) return;
        
        const li = document.createElement('li');
        const urgency = calculateUrgency(client);
        li.textContent = `${client.name} (${todo.isMandatory ? '强制' : '可选'}) - 分数: ${urgency.toFixed(1)}`;
        if (todo.completed) li.style.textDecoration = 'line-through';
        
        let color = 'green';
        if (urgency > 100) color = '#e74c3c';
        else if (urgency > 50) color = 'orange';
        li.style.color = color;
        
        const completeBtn = document.createElement('button');
        completeBtn.textContent = '完成';
        completeBtn.onclick = () => completeTask(todo.clientId);
        li.appendChild(completeBtn);
        
        tasksList.appendChild(li);
    });
    
    const penaltyDiv = document.getElementById('penalty');
    if (penaltyDiv) penaltyDiv.textContent = `当前扣分: ${localStorage.getItem('penalty') || 0}`;
}

// 渲染详细待办列表（新增）
function renderTodoList() {
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        let color = 'green';
        if (task.urgency > 100) color = '#e74c3c';
        else if (task.urgency > 50) color = 'orange';
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask(this, ${index})">
            <span style="color: ${color};">${task.description || `${task.type === 'manual' ? '[手动]' : '[自动]'} 联系 ${task.name}: ${task.suggestion}`}</span>
        `;
        todoList.appendChild(li);
    });
}

// 更新任务（新增，完成时更新）
function updateTask(checkbox, index) {
    const task = tasks[index];
    if (checkbox.checked && !task.completed) {
        task.completed = true;
        const allRelations = [...relations.companies, ...relations.clients];
        const rel = allRelations.find(r => r.name === task.name);
        if (rel) {
            rel.lastContactDate = new Date().toISOString().split('T')[0];
            saveData();
            score += task.reward || 10; // 加奖励到总得分（默认10）
            updateScore('完成任务', rel.importance); // 示例更新得分
        }
        displayTasks();
        updateCalendarEvents();
        renderTodoList();
        updateTaskProgress(); // 更新进度条
    }
}

// 更新任务进度条（新增）
function updateTaskProgress() {
    const completedCount = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const progressEl = document.getElementById('taskProgress');
    if (progressEl) progressEl.innerHTML = `进度: ${completedCount}/${total} (${progress}%) <progress id="progressBar" value="${progress}" max="100"></progress>`;
    // 计算本周总得分（基于完成任务奖励）
    score = tasks.reduce((acc, t) => acc + (t.completed ? (t.reward || 10) : 0), 0);
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = score;
    // 更新日历事件标题添加进度
    if (_calendarInstance) {
        _calendarInstance.getEvents().forEach(event => {
            if (event.title.includes('联系')) event.setProp('title', `${event.title} - 进度: ${completedCount}/${total}`);
        });
    }
}

// 浮动加号模态（新增，支持手动任务或选择联系）
function showAddModal() {
    document.getElementById('addModal').style.display = 'flex';
    const type = document.getElementById('addType');
    type.onchange = () => {
        const content = document.getElementById('addFormContent');
        content.innerHTML = ''; // 清空
        if (type.value === 'client') {
            content.innerHTML = `
                <label>名称:</label><input id="quickName"><br>
                <label>重要度 (5最高-1最低):</label><select id="quickImportance"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select><br>
                <label>亲密度:</label><select id="quickQuality"><option>S</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select><br>
                <label>代码:</label><input id="quickCode"><br>
                <label>职位:</label><input id="quickPosition"><br>
                <label>联系方式:</label><input id="quickContact"><br>
                <label>最后联系时间:</label><input id="quickLastContact" type="date"><br>
                <label>标签:</label><select id="quickTags" multiple></select><br>
                <button onclick="addNewTag('client')">新建标签</button>
            `;
        } else if (type.value === 'company') {
            content.innerHTML = `
                <label>名称:</label><input id="quickName"><br>
                <label>重要度 (5最高-1最低):</label><select id="quickImportance"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select><br>
                <label>亲密度:</label><select id="quickQuality"><option>S</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select><br>
                <label>代码:</label><input id="quickCode"><br>
                <label>职位:</label><input id="quickPosition"><br>
                <label>联系方式:</label><input id="quickContact"><br>
                <label>最后联系时间:</label><input id="quickLastContact" type="date"><br>
                <label>标签:</label><select id="quickTags" multiple></select><br>
                <button onclick="addNewTag('company')">新建标签</button>
            `;
        } else if (type.value === 'task') {
                content.innerHTML = `
                    <label>类型:</label><select id="taskSubType"><option value="manual">手动备忘</option><option value="contact">选择联系客户</option></select><br>
                    <div id="taskDetails"></div>
                `;
                document.getElementById('taskSubType').onchange = updateTaskForm;
                updateTaskForm(); // 初始化加载表单
            } else {
                content.innerHTML = `<label>任务描述:</label><input id="quickTaskDesc"><br>`;
            }
    };
    type.onchange(); // 初始化
}

function updateTaskForm() {
    const subType = document.getElementById('taskSubType').value;
    const details = document.getElementById('taskDetails');
    details.innerHTML = '';
    if (subType === 'manual') {
        details.innerHTML = `
            <label>任务名称:</label><input id="manualName"><br>
            <label>行动:</label><input id="manualAction"><br>
            <label>奖励 (1-20):</label><input id="manualReward" type="number" min="1" max="20"><br>
            <label>时间范围:</label><select id="manualTime"><option>本周</option><option>本周+下周</option></select><br>
        `;
    } else if (subType === 'contact') {
        details.innerHTML = `
            <label>选择模式:</label><select id="contactMode"><option>top10</option><option>list</option><option>random</option></select><br>
            <div id="contactSelection"></div>
            <label>时间范围:</label><select id="contactTime"><option>本周</option><option>本周+下周</option></select><br>
        `;
        document.getElementById('contactMode').onchange = updateContactSelection;
        updateContactSelection();
    }
}

function updateContactSelection() {
    const mode = document.getElementById('contactMode').value;
    const selection = document.getElementById('contactSelection');
    selection.innerHTML = '';
    const all = [...relations.clients, ...relations.companies];
    if (mode === 'top10') {
        all.sort((a, b) => calculateUrgency(b) - calculateUrgency(a));
        const top10 = all.slice(0, 10);
        top10.forEach((item, idx) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}" checked> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
            selection.appendChild(label);
        });
    } else if (mode === 'list') {
        all.forEach((item, idx) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}"> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
            selection.appendChild(label);
        });
    } else if (mode === 'random') {
        const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, 5); // 示例随机5个
        shuffled.forEach((item, idx) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}" checked> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
            selection.appendChild(label);
        });
    }
}

function closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
}

function saveQuickAdd() {
    const type = document.getElementById('addType').value;
    if (type === 'client') {
        const name = (document.getElementById('quickName') || {}).value;
        if (!name) { alert('名称不能为空'); return; }
        const client = {
            id: generateId(),
            name: document.getElementById('quickName').value,
            importance: document.getElementById('quickImportance').value,
            quality: document.getElementById('quickQuality').value,
            code: document.getElementById('quickCode').value,
            position: document.getElementById('quickPosition').value,
            contact: document.getElementById('quickContact').value,
            tags: Array.from((document.getElementById('quickTags') || {}).selectedOptions || []).map(o => o.value),
            addedDate: new Date().toLocaleDateString(),
            lastContactDate: (document.getElementById('quickLastContact') && document.getElementById('quickLastContact').value) ? document.getElementById('quickLastContact').value : new Date().toISOString().split('T')[0],
            interactions: [],
            months1: '否',
            months2: '否',
            latest: '/'
        };
        relations.clients.push(client);
        (client.tags || []).forEach(tn => {
            const t = tags.find(x => x.name === tn);
            if (t) {
                t.associatedItems = t.associatedItems || [];
                if (!t.associatedItems.includes(client.id)) t.associatedItems.push(client.id);
            }
        });
        saveTags();
    } else if (type === 'company') {
        const name = document.getElementById('quickName').value;
        if (!name) { alert('名称不能为空'); return; }
        const company = {
            id: generateId(),
            name,
            importance: document.getElementById('quickImportance').value,
            quality: document.getElementById('quickQuality').value,
            code: document.getElementById('quickCode').value,
            position: document.getElementById('quickPosition').value,
            contact: document.getElementById('quickContact').value,
            tags: Array.from((document.getElementById('quickTags') || {}).selectedOptions || []).map(o => o.value),
            addedDate: new Date().toLocaleDateString(),
            lastContactDate: (document.getElementById('quickLastContact') && document.getElementById('quickLastContact').value) ? document.getElementById('quickLastContact').value : new Date().toISOString().split('T')[0],
            interactions: [],
            months1: '否',
            months2: '否',
            months3: '否',
            survey: '否',
            report: '否',
            strategy: '否',
            roadshow: '否',
            title: 'IR'
        };
        relations.companies.push(company);
        (company.tags || []).forEach(tn => {
            const t = tags.find(x => x.name === tn);
            if (t) {
                t.associatedItems = t.associatedItems || [];
                if (!t.associatedItems.includes(company.id)) t.associatedItems.push(company.id);
            }
        });
        saveTags();
    } else if (type === 'task') {
        const subTypeEl = document.getElementById('taskSubType');
        const subType = subTypeEl ? subTypeEl.value : null;
        if (subType === 'manual') {
            const manualNameEl = document.getElementById('manualName');
            const manualActionEl = document.getElementById('manualAction');
            const manualRewardEl = document.getElementById('manualReward');
            const manualTimeEl = document.getElementById('manualTime');
            const name = manualNameEl ? manualNameEl.value : '';
            const suggestion = manualActionEl ? manualActionEl.value : '';
            const reward = parseInt(manualRewardEl ? manualRewardEl.value : 10) || 10;
            const timeRange = manualTimeEl ? manualTimeEl.value : '本周';
            if (!name) { alert('名称不能为空'); return; }
            tasks.push({ name, suggestion, urgency: 0, daysSince: 0, completed: false, type: 'manual', reward: Math.min(20, Math.max(1, reward)), timeRange });
            addToCalendar({ title: name, start: getWeekStartDate(timeRange), color: '#e74c3c' }); // 添加到日历
        } else if (subType === 'contact') {
            // 使用原有选择逻辑：从 #contactSelection 中读取选中项并添加任务
            const selected = Array.from(document.querySelectorAll('#contactSelection input:checked')).map(input => input.value);
            const timeRangeEl = document.getElementById('contactTime');
            const timeRange = timeRangeEl ? timeRangeEl.value : '本周';
            selected.forEach(name => {
                tasks.push({ name, suggestion: '打电话', urgency: 50, daysSince: 0, completed: false, type: 'manual', reward: 10, timeRange });
            });
            addToCalendar({ title: `联系客户 (${selected.length}个)`, start: getWeekStartDate(timeRange), color: '#e74c3c' });
        }
        displayTasks();
        updateCalendarEvents();
    }
    saveData();
    renderLists();
    renderTodoList();
    closeAddModal();
}

// 获取周起始日期（本周或本周+下周）
function getWeekStartDate(timeRange) {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // 周一
    if (timeRange === '本周+下周') {
        start.setDate(start.getDate() + 7);
    }
    return start.toISOString().slice(0,10);
}

// 添加到日历（示例，每周工作日添加红色任务）
function addToCalendar(event) {
    if (_calendarInstance) {
        const workDays = [1,2,3,4,5]; // 周一到周五
        workDays.forEach(day => {
            const date = new Date(event.start);
            date.setDate(date.getDate() + day - 1);
            _calendarInstance.addEvent({ ...event, start: date.toISOString().slice(0,10) });
        });
    }
}

function promptOptional() {
    const count = parseInt(prompt('想联系几个客户？'));
    const tag = prompt('指定标签（空=所有）');
    const mode = prompt('模式：top (前N紧急) 或 random');
    
    generateWeeklyTodos({ count, tag, mode });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('todos')) {
        generateWeeklyTodos();
    }
    renderTodos();
});

// 重置本周任务（UI按钮调用）
function resetWeeklyTasks() {
    if (confirm('是否重置本周任务？')) {
        tasks = []; // 清空任务
        localStorage.removeItem('todos'); // 清空存储
        score = 0; // 重置得分
        localStorage.setItem('penalty', '0');
        generateWeeklyTodos(); // 重新生成
        displayTasks();
        updateTaskProgress();
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.innerText = score;
    }
}

// 生成标签颜色（基于字符串hash）
function tagColor(tag) {
    if (!tag) return '#888';
    let h = 0;
    for (let i = 0; i < tag.length; i++) {
        h = (h << 5) - h + tag.charCodeAt(i);
        h |= 0;
    }
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 60%, 40%)`;
}

// 新建标签并追加到静态表单和快速添加模态
function addNewTag(type) {
    const name = prompt('标签名称:');
    if (!name) return;
    const color = prompt('颜色 (e.g., #ff0000 或 red):', '#3498db');
    tags.push({ name, color, associatedItems: [] });
    saveTags();
    populateTagSelects();
}

// 更新下拉选择（表格编辑）
function updateSelect(type, index, field, value) {
    relations[type][index][field] = value;
    saveData();
    renderLists(); // 刷新表格
}