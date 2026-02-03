let relations = JSON.parse(localStorage.getItem('relations')) || { companies: [], clients: [] };
let tasks = [];
let score = 0;
let weeklyScores = JSON.parse(localStorage.getItem('weeklyScores')) || [];
let tags = JSON.parse(localStorage.getItem('tags')) || [];

function loadData() {
    relations = { companies: [], clients: [] };
    loadTags();
    const saved = localStorage.getItem('relations');
    if (saved) {
        try {
            relations = JSON.parse(saved);
            console.log('加载数据:', relations);
            [...relations.companies, ...relations.clients].forEach(item => {
                if (!item.addedDate) item.addedDate = new Date().toLocaleDateString();
                if (!item.lastContactDate) item.lastContactDate = new Date().toISOString().split('T')[0];
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

function showSection(section) {
    document.querySelectorAll('.section').forEach(el => el.style.display = 'none');
    document.getElementById(section).style.display = 'block';
}

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

function saveRelation(type) {
    const name = document.getElementById('name').value;
    const importance = document.getElementById('importance').value;
    const quality = document.getElementById('quality').value;
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
        lastInteraction: new Date().toISOString(),
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

    let typeKey = type;
    if (!typeKey) {
        typeKey = currentType === 'company' ? 'companies' : 'clients';
    }
    if (typeKey === 'company') typeKey = 'companies';
    if (typeKey === 'client') typeKey = 'clients';

    if (!relations[typeKey]) {
        relations[typeKey] = [];
    }

    if (currentIndex === -1) {
        relations[typeKey].push(relation);
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
            return `<span class="inline-block px-3 py-1 rounded-full text-sm text-white" style="background:${color}">${tagName}</span>`;
        }).join(' ');
        const tr = document.createElement('tr');
        tr.className = 'bg-white';
        tr.innerHTML = `
            <td class="p-4">${index + 1}</td>
            <td class="p-4">${client.code || ''}</td>
            <td class="p-4">${client.name}</td>
            <td class="p-4">${clientTags}</td>
            <td class="p-4">${client.importance} [5最高-1最低]</td>
            <td class="p-4">${client.quality}</td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('clients', ${index}, 'months1', this.value)"><option value="是" ${months1==='是'?'selected':''}>是</option><option value="否" ${months1==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('clients', ${index}, 'months2', this.value)"><option value="是" ${months2==='是'?'selected':''}>是</option><option value="否" ${months2==='否'?'selected':''}>否</option></select></td>
            <td class="p-4">${latest}</td>
            <td class="p-4"><button onclick="editItem('clients', ${index})" class="bg-blue-500 text-white py-1 px-3 rounded">编辑</button> <button class="delete bg-red-500 text-white py-1 px-3 rounded ml-2" onclick="deleteItem('clients', ${index})">删除</button></td>
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
            return `<span class="inline-block px-3 py-1 rounded-full text-sm text-white" style="background:${color}">${tagName}</span>`;
        }).join(' ');
        const tr = document.createElement('tr');
        tr.className = 'bg-white';
        tr.innerHTML = `
            <td class="p-4">${company.name}</td>
            <td class="p-4">${company.position || ''}</td>
            <td class="p-4"><select class="p-2 border rounded" onchange="updateSelect('companies', ${index}, 'title', this.value)"><option ${company.title==='正代董秘'?'selected':''}>正代董秘</option><option ${company.title==='IR'?'selected':''}>IR</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'months1', this.value)"><option value="是" ${months1==='是'?'selected':''}>是</option><option value="否" ${months1==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'months2', this.value)"><option value="是" ${months2==='是'?'selected':''}>是</option><option value="否" ${months2==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'months3', this.value)"><option value="是" ${months3==='是'?'selected':''}>是</option><option value="否" ${months3==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'survey', this.value)"><option value="是" ${company.survey==='是'?'selected':''}>是</option><option value="否" ${company.survey==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'report', this.value)"><option value="是" ${company.report==='是'?'selected':''}>是</option><option value="否" ${company.report==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'strategy', this.value)"><option value="是" ${company.strategy==='是'?'selected':''}>是</option><option value="否" ${company.strategy==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><select class="yes-no-select p-2 border rounded" onchange="updateSelect('companies', ${index}, 'roadshow', this.value)"><option value="是" ${company.roadshow==='是'?'selected':''}>是</option><option value="否" ${company.roadshow==='否'?'selected':''}>否</option></select></td>
            <td class="p-4"><button onclick="editItem('companies', ${index})" class="bg-blue-500 text-white py-1 px-3 rounded">编辑</button> <button class="delete bg-red-500 text-white py-1 px-3 rounded ml-2" onclick="deleteItem('companies', ${index})">删除</button></td>
        `;
        companyTbody.appendChild(tr);
    });

    document.querySelectorAll('.yes-no-select').forEach(select => {
        updateSelectColor(select);
        select.addEventListener('change', () => updateSelectColor(select));
    });
}

function updateSelectColor(select) {
    if (select.value === '是') {
        select.style.backgroundColor = '#d4edda';
        select.style.color = '#155724';
    } else if (select.value === '否') {
        select.style.backgroundColor = '#f8d7da';
        select.style.color = '#721c24';
    } else {
        select.style.backgroundColor = '';
        select.style.color = '';
    }
}

function deleteItem(type, index) {
    if (confirm('确认删除?')) {
        const item = relations[type][index];
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

function editItem(type, index) {
    const editType = type === 'clients' ? 'client' : 'company';
    editRelation(editType, index);
}

function editRelation(type, index) {
    currentType = type;
    currentIndex = index;
    const list = type === 'company' ? relations.companies : relations.clients;
    const item = list[index];
    document.getElementById('editType').value = type === 'company' ? 'companies' : 'clients';
    document.getElementById('editIndex').value = index;
    document.getElementById('editName').value = item.name;
    document.getElementById('editImportance').value = item.importance;
    document.getElementById('editQuality').value = item.quality;
    document.getElementById('editCode').value = item.code || '';
    document.getElementById('editPosition').value = item.position || '';
    document.getElementById('editContact').value = item.contact || '';
    document.getElementById('editLastContact').value = item.lastContactDate || '';
    const editTagsSelect = document.getElementById('editTags');
    populateTagSelects();
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

window.onload = loadData;

function recordInteraction(type, index) {
    const interactionType = prompt('互动类型: 发消息/打电话/路演');
    const note = prompt('互动摘要:');
    const feedback = prompt('反馈结果: 正向/中性/负向');
    const list = type === 'company' ? relations.companies : relations.clients;
    list[index].interactions.push({ date: new Date().toISOString(), type: interactionType, note, feedback });
    list[index].lastInteraction = new Date().toISOString();
    list[index].lastContactDate = new Date().toISOString().split('T')[0];
    const qualityLevels = ['S', 'A', 'B', 'C', 'D', 'E'];
    let currentIdx = qualityLevels.indexOf(list[index].quality);
    if (feedback === '正向') {
        currentIdx = Math.max(0, currentIdx - 1);
    } else if (feedback === '负向') {
        currentIdx = Math.min(5, currentIdx + 1);
    }
    list[index].quality = qualityLevels[currentIdx];
    saveData();
    renderLists();
    generateWeeklyTodos();
    updateCalendarEvents();
    updateScore(interactionType, list[index].importance);
}

function generateWeeklyTasks() {
    tasks = [];
    const taskList = document.getElementById('taskList');
    if (taskList) taskList.innerHTML = '';

    const now = new Date().toISOString().split('T')[0];
    const allRelations = [...relations.companies, ...relations.clients];
    allRelations.forEach((item) => {
        const urgency = calculateUrgency(item);
        if (urgency > 10) {
            tasks.push({ name: item.name, suggestion: urgency > 60 ? '路演' : (urgency > 30 ? '打电话' : '发消息'), urgency, daysSince: daysBetween(item.lastContactDate, now), completed: false, type: 'auto', reward: 0 });
        }
    });
    tasks.sort((a, b) => b.urgency - a.urgency);
    tasks = tasks.slice(0, 20);
    displayTasks();
    populateCalendar();
    updateCalendarEvents();
}

function displayTasks() {
    const ul = document.getElementById('taskList');
    ul.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow';
        let color = 'text-black';
        if (task.urgency > 100) color = 'text-red-500';
        else if (task.urgency > 50) color = 'text-orange-500';
        else color = 'text-green-500';
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask(this, ${index})" class="mr-4 accent-indigo-500">
            <span class="${color} flex-1">${task.type === 'manual' ? '[手动]' : '[自动]'} 联系 ${task.name}: ${task.suggestion} (距上次${Math.floor(task.daysSince)}天, 紧迫度: ${task.urgency.toFixed(2)}, 奖励: ${task.reward})</span>
        `;
        ul.appendChild(li);
    });
    renderTodoList();
    updateTaskProgress();
}

function updateScore(actionType, importance) {
    let basePoints = 0;
    if (actionType === '发消息') basePoints = 5;
    else if (actionType === '打电话') basePoints = 10;
    else if (actionType === '路演') basePoints = 30;
    let multiplier = 1;
    if (importance === 5) multiplier = 2.0;
    else if (importance <= 2) multiplier = 0.5;
    score += basePoints * multiplier;
    document.getElementById('score').innerText = Math.floor(score);
    if (score >= 100) alert('本周目标达成！去喝一杯奖励自己吧！');
}

function resetScore() {
    weeklyScores.push(score);
    if (weeklyScores.length > 4) weeklyScores.shift();
    localStorage.setItem('weeklyScores', JSON.stringify(weeklyScores));
    score = 0;
    document.getElementById('score').innerText = Math.floor(score);
    drawChart();
}

function addTaskPrompt() {
    const name = prompt('任务目标名称 (例如: 张三 或 手动备忘: 会议)');
    if (!name) return;
    const suggestion = prompt('建议行动 (发消息/打电话/路演/其他)', '其他');
    const reward = parseInt(prompt('设置奖励分 (1-20)', '10')) || 10;
    tasks.unshift({ name, suggestion, urgency: 0, daysSince: 0, completed: false, type: 'manual', reward: Math.min(20, Math.max(1, reward)) });
    displayTasks();
    populateCalendar();
}

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

function quickAddSave() {
    const type = document.getElementById('addType').value;
    if (type === 'companies') {
        addCompany();
    } else {
        addClient();
    }
    updateStats();
}

function addClient() {
    const client = {
        id: generateId(),
        name: document.getElementById('clientName').value,
        importance: document.getElementById('clientImportance').value,
        quality: document.getElementById('clientQuality').value,
        position: document.getElementById('clientPosition').value,
        tags: Array.from((document.getElementById('clientTags') || {}).selectedOptions || []).map(o => o.value),
        addedDate: new Date().toLocaleDateString(),
        lastContactDate: (document.getElementById('clientLastContact') && document.getElementById('clientLastContact').value) ? document.getElementById('clientLastContact').value : new Date().toISOString().split('T')[0],
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
    saveData();
    renderLists();
    clearAddForms();
}

function addCompany() {
    const company = {
        id: generateId(),
        name: document.getElementById('companyName').value,
        importance: document.getElementById('companyImportance').value,
        quality: document.getElementById('companyQuality').value,
        code: document.getElementById('companyCode').value,
        position: document.getElementById('companyPosition').value,
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

function clearAddForms() {
    document.querySelectorAll('.add-form input, .add-form select').forEach(el => el.value = '');
}

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
            data: { labels: ['公司', '客户'], datasets: [{ data: [companies, clients], backgroundColor: ['#6366f1', '#ec4899'] }] }
        });
    } catch (e) {
        console.warn('无法绘制统计图', e);
    }
}

function drawChart() {
    const ctx = document.getElementById('scoreChart');
    if (!ctx) return;
    const context = ctx.getContext('2d');
    if (window._scoreChartInstance) {
        window._scoreChartInstance.destroy();
    }
}

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
    document.getElementById('historyModal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

function initKChart(rangeDays = 14) {
    const canvas = document.getElementById('myChart');
    if (!canvas) return;
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - rangeDays + 1);
    const dayScores = {};
    for (let d = 0; d < rangeDays; d++) {
        const dt = new Date(start);
        dt.setDate(start.getDate() + d);
        const key = dt.toISOString().slice(0,10);
        dayScores[key] = 0;
    }
    const all = [...(relations.companies || []), ...(relations.clients || [])];
    all.forEach(rel => {
        (rel.interactions || []).forEach(inter => {
            const dateKey = (new Date(inter.date)).toISOString().slice(0,10);
            if (dateKey in dayScores) dayScores[dateKey] += 10;
        });
    });
    const data = Object.keys(dayScores).map(dateKey => {
        const s = dayScores[dateKey] || 0;
        const open = s + (Math.random() - 0.5) * 2;
        const close = s + (Math.random() - 0.5) * 2;
        const high = Math.max(open, close) + Math.random() * 1;
        const low = Math.min(open, close) - Math.random() * 1;
        return { x: dateKey, o: +open.toFixed(2), h: +high.toFixed(2), l: +low.toFixed(2), c: +close.toFixed(2) };
    });
    if (window._kChartInstance) window._kChartInstance.destroy();
    try {
        const ctx = canvas.getContext('2d');
        window._kChartInstance = new Chart(ctx, {
            type: 'candlestick',
            data: { datasets: [{ label: '每天得分趋势', data, color: { up: '#ec4899', down: '#6366f1', unchanged: '#a855f7' } }] },
            options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 0 } } } }
        });
    } catch (e) {
        console.warn('无法初始化 K 线图:', e);
    }
}

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
            card.className = 'p-4 bg-white rounded-lg shadow-sm';
            const img = document.createElement('img');
            img.src = client.avatar || 'avatar.jpg';
            img.alt = '头像';
            img.className = 'w-12 h-12 rounded-full';
            const info = document.createElement('p');
            const lastStr = last ? last.toISOString().slice(0,10) : '无';
            info.innerHTML = `姓名: ${client.name || ''}<br>公司: ${client.code || ''}<br>最后联系: ${lastStr}`;
            const btn = document.createElement('button');
            btn.innerText = '立即联系';
            btn.onclick = () => recordInteraction('client', idx);
            btn.className = 'mt-2 gradient-bg text-white py-1 px-3 rounded';
            card.appendChild(img);
            card.appendChild(info);
            card.appendChild(btn);
            container.appendChild(card);
        }
    });
}

let _calendarInstance = null;
function initCalendar() {
    const el = document.getElementById('calendar-container');
    if (!el) {
        console.error('找不到日历容器: calendar-container');
        return;
    }
    if (_calendarInstance) {
        try { _calendarInstance.destroy(); } catch (e) {}
        _calendarInstance = null;
    }
    _calendarInstance = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        height: 'auto',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' },
        events: [],
        dateClick: function(info) {
            showCalendarDetail(info.dateStr);
        },
        locale: 'zh-cn',
        editable: false,
        navLinks: true
    });
    _calendarInstance.render();
    populateCalendar();
}

function populateCalendar() {
    if (!_calendarInstance) return;
    const events = [];
    const all = [...(relations.companies || []), ...(relations.clients || [])];
    all.forEach(rel => {
        (rel.interactions || []).forEach(inter => {
            const d = inter.date ? inter.date.slice(0,10) : null;
            if (d) events.push({ title: `${inter.type}：${rel.name}`, start: d, display: 'background', backgroundColor: '#cfe8ff', borderColor: '#9fd0ff' });
        });
    });
    (tasks || []).forEach(t => {
        const today = new Date().toISOString().slice(0,10);
        events.push({ title: `联系 ${t.name}`, start: today, color: '#ff6b6b' });
    });
    _calendarInstance.removeAllEvents();
    _calendarInstance.addEventSource(events);
}

function updateCalendarEvents() {
    if (!_calendarInstance) return;
    const events = [];
    tasks.forEach(task => {
        const event = {
            title: `联系 ${task.name}`,
            start: new Date().toISOString().slice(0,10),
            color: task.completed ? '#3498db' : '#e74c3c'
        };
        events.push(event);
    });
    _calendarInstance.removeAllEvents();
    _calendarInstance.addEventSource(events);
    updateTaskProgress();
}

function generateMandatoryTasks() {
    const mandatory = [];
    for (let client of relations.clients) {
        const urgency = calculateUrgency(client);
        if (urgency >= 100 || client.isFrozen) {
            if (client.id) mandatory.push(client.id);
        }
    }
    return mandatory;
}

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
    generateWeeklyTasks();
}

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
        initKChart();
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

function renderTodoList() {
    const todoList = document.getElementById('todoList');
    todoList.innerHTML = '';
    tasks.forEach((task, index) => {
        const li = document.createElement('li');
        li.className = 'flex items-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow';
        let color = 'text-green-500';
        if (task.urgency > 100) color = 'text-red-500';
        else if (task.urgency > 50) color = 'text-orange-500';
        li.innerHTML = `
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="updateTask(this, ${index})" class="mr-4 accent-indigo-500">
            <span class="${color} flex-1">${task.description || `${task.type === 'manual' ? '[手动]' : '[自动]'} 联系 ${task.name}`}</span>
        `;
        todoList.appendChild(li);
    });
}

function updateTask(checkbox, index) {
    const task = tasks[index];
    if (checkbox.checked && !task.completed) {
        task.completed = true;
        const allRelations = [...relations.companies, ...relations.clients];
        const rel = allRelations.find(r => r.name === task.name);
        if (rel) {
            rel.lastContactDate = new Date().toISOString().split('T')[0];
            saveData();
            score += task.reward || 10;
            updateScore('完成任务', rel.importance);
        }
        displayTasks();
        updateCalendarEvents();
        initKChart();
        renderTodoList();
        updateTaskProgress();
    }
}

function updateTaskProgress() {
    const completedCount = tasks.filter(t => t.completed).length;
    const total = tasks.length;
    const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const progressEl = document.getElementById('taskProgress');
    if (progressEl) progressEl.innerHTML = `进度: ${completedCount}/${total} (${progress}%) <progress value="${progress}" max="100" class="ml-2 w-24 accent-indigo-500"></progress>`;
    score = tasks.reduce((acc, t) => acc + (t.completed ? (t.reward || 10) : 0), 0);
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = score;
    if (_calendarInstance) {
        _calendarInstance.getEvents().forEach(event => {
            if (event.title.includes('联系')) event.setProp('title', `${event.title} - 进度: ${completedCount}/${total}`);
        });
    }
}

function showAddModal() {
    document.getElementById('addModal').style.display = 'flex';
    const type = document.getElementById('addType');
    type.onchange = () => {
        const content = document.getElementById('addFormContent');
        content.innerHTML = '';
        if (type.value === 'client') {
            content.innerHTML = `
                <label class="block text-sm font-medium">名称:</label><input id="quickName" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">重要度:</label><select id="quickImportance" class="w-full p-2 border rounded-lg mb-3"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
                <label class="block text-sm font-medium">亲密度:</label><select id="quickQuality" class="w-full p-2 border rounded-lg mb-3"><option>S</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select>
                <label class="block text-sm font-medium">职位:</label><input id="quickPosition" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">最后联系时间:</label><input id="quickLastContact" type="date" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">标签:</label><select id="quickTags" multiple class="w-full p-2 border rounded-lg mb-3"></select>
                <button onclick="addNewTag('client')" class="text-indigo-500 hover:underline">新建标签</button>
            `;
        } else if (type.value === 'company') {
            content.innerHTML = `
                <label class="block text-sm font-medium">名称:</label><input id="quickName" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">重要度:</label><select id="quickImportance" class="w-full p-2 border rounded-lg mb-3"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select>
                <label class="block text-sm font-medium">亲密度:</label><select id="quickQuality" class="w-full p-2 border rounded-lg mb-3"><option>S</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option></select>
                <label class="block text-sm font-medium">公司领导:</label><input id="quickCode" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">职位:</label><input id="quickPosition" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">最后联系时间:</label><input id="quickLastContact" type="date" class="w-full p-2 border rounded-lg mb-3">
                <label class="block text-sm font-medium">标签:</label><select id="quickTags" multiple class="w-full p-2 border rounded-lg mb-3"></select>
                <button onclick="addNewTag('company')" class="text-indigo-500 hover:underline">新建标签</button>
            `;
        } else if (type.value === 'task') {
            content.innerHTML = `
                <label class="block text-sm font-medium">类型:</label><select id="taskSubType" class="w-full p-2 border rounded-lg mb-3"><option value="manual">手动备忘</option><option value="contact">选择联系客户</option></select>
                <div id="taskDetails" class="space-y-3"></div>
            `;
            document.getElementById('taskSubType').onchange = updateTaskForm;
            updateTaskForm();
        }
    };
    type.onchange();
}

function updateTaskForm() {
    const subType = document.getElementById('taskSubType').value;
    const details = document.getElementById('taskDetails');
    details.innerHTML = '';
    if (subType === 'manual') {
        details.innerHTML = `
            <label class="block text-sm font-medium">任务名称:</label><input id="manualName" class="w-full p-2 border rounded-lg mb-3">
            <label class="block text-sm font-medium">行动:</label><input id="manualAction" class="w-full p-2 border rounded-lg mb-3">
            <label class="block text-sm font-medium">奖励 (1-20):</label><input id="manualReward" type="number" min="1" max="20" class="w-full p-2 border rounded-lg mb-3">
            <label class="block text-sm font-medium">时间:</label><select id="manualTime" class="w-full p-2 border rounded-lg mb-3"><option value="today">今天</option><option value="tomorrow">明天</option><option value="this_week">本周</option><option value="this_next_week">本周+下周</option><option value="custom">自定义日期</option></select>
            <div id="customDate" style="display: none;"><label class="block text-sm font-medium">自定义日期:</label><input id="manualCustomDate" type="date" class="w-full p-2 border rounded-lg mb-3"></div>
        `;
        document.getElementById('manualTime').onchange = () => {
            document.getElementById('customDate').style.display = document.getElementById('manualTime').value === 'custom' ? 'block' : 'none';
        };
    } else if (subType === 'contact') {
        details.innerHTML = `
            <label class="block text-sm font-medium">选择模式:</label><select id="contactMode" class="w-full p-2 border rounded-lg mb-3"><option>top10</option><option>list</option><option>random</option></select>
            <div id="contactSelection" class="space-y-2"></div>
            <label class="block text-sm font-medium">时间:</label><select id="contactTime" class="w-full p-2 border rounded-lg mb-3"><option value="today">今天</option><option value="tomorrow">明天</option><option value="this_week">本周</option><option value="this_next_week">本周+下周</option><option value="custom">自定义日期</option></select>
            <div id="customDateContact" style="display: none;"><label class="block text-sm font-medium">自定义日期:</label><input id="contactCustomDate" type="date" class="w-full p-2 border rounded-lg mb-3"></div>
        `;
        document.getElementById('contactMode').onchange = updateContactSelection;
        updateContactSelection();
        document.getElementById('contactTime').onchange = () => {
            document.getElementById('customDateContact').style.display = document.getElementById('contactTime').value === 'custom' ? 'block' : 'none';
        };
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
        top10.forEach((item) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}" checked class="mr-2"> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
            selection.appendChild(label);
        });
    } else if (mode === 'list') {
        all.forEach((item) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}" class="mr-2"> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
            selection.appendChild(label);
        });
    } else if (mode === 'random') {
        const shuffled = all.sort(() => 0.5 - Math.random()).slice(0, 5);
        shuffled.forEach((item) => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${item.name}" checked class="mr-2"> ${item.name} (紧急: ${calculateUrgency(item).toFixed(2)})<br>`;
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
        const name = document.getElementById('quickName').value;
        if (!name) { alert('名称不能为空'); return; }
        const client = {
            id: generateId(),
            name,
            importance: document.getElementById('quickImportance').value,
            quality: document.getElementById('quickQuality').value,
            position: document.getElementById('quickPosition').value,
            tags: Array.from(document.getElementById('quickTags').selectedOptions).map(o => o.value),
            addedDate: new Date().toLocaleDateString(),
            lastContactDate: document.getElementById('quickLastContact').value || new Date().toISOString().split('T')[0],
            interactions: [],
            months1: '否',
            months2: '否',
            latest: '/'
        };
        relations.clients.push(client);
        client.tags.forEach(tn => {
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
            tags: Array.from(document.getElementById('quickTags').selectedOptions).map(o => o.value),
            addedDate: new Date().toLocaleDateString(),
            lastContactDate: document.getElementById('quickLastContact').value || new Date().toISOString().split('T')[0],
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
        company.tags.forEach(tn => {
            const t = tags.find(x => x.name === tn);
            if (t) {
                t.associatedItems = t.associatedItems || [];
                if (!t.associatedItems.includes(company.id)) t.associatedItems.push(company.id);
            }
        });
        saveTags();
    } else if (type === 'task') {
        const subType = document.getElementById('taskSubType').value;
        if (subType === 'manual') {
            const name = document.getElementById('manualName').value;
            const suggestion = document.getElementById('manualAction').value;
            const reward = parseInt(document.getElementById('manualReward').value) || 10;
            const timeRange = document.getElementById('manualTime').value;
            let startDate;
            if (timeRange === 'today') {
                startDate = new Date().toISOString().slice(0,10);
            } else if (timeRange === 'tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                startDate = tomorrow.toISOString().slice(0,10);
            } else if (timeRange === 'custom') {
                startDate = document.getElementById('manualCustomDate').value;
                if (!startDate) { alert('请选择日期'); return; }
            } else {
                startDate = getWeekStartDate(timeRange);
            }
            if (!name) { alert('名称不能为空'); return; }
            tasks.push({ name, suggestion, urgency: 0, daysSince: 0, completed: false, type: 'manual', reward: Math.min(20, Math.max(1, reward)), timeRange, startDate });
            addToCalendar({ title: name, start: startDate, color: '#e74c3c' });
        } else if (subType === 'contact') {
            const selected = Array.from(document.querySelectorAll('#contactSelection input:checked')).map(input => input.value);
            const timeRange = document.getElementById('contactTime').value;
            let startDate;
            if (timeRange === 'today') {
                startDate = new Date().toISOString().slice(0,10);
            } else if (timeRange === 'tomorrow') {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                startDate = tomorrow.toISOString().slice(0,10);
            } else if (timeRange === 'custom') {
                startDate = document.getElementById('contactCustomDate').value;
                if (!startDate) { alert('请选择日期'); return; }
            } else {
                startDate = getWeekStartDate(timeRange);
            }
            selected.forEach(name => {
                tasks.push({ name, suggestion: '打电话', urgency: 50, daysSince: 0, completed: false, type: 'manual', reward: 10, timeRange, startDate });
            });
            addToCalendar({ title: `联系客户 (${selected.length}个)`, start: startDate, color: '#e74c3c' });
        }
        displayTasks();
        updateCalendarEvents();
    }
    saveData();
    renderLists();
    renderTodoList();
    closeAddModal();
}

function getWeekStartDate(timeRange) {
    const today = new Date();
    const start = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    if (timeRange === 'this_next_week') {
        start.setDate(start.getDate() + 7);
    }
    return start.toISOString().slice(0,10);
}

function addToCalendar(event) {
    if (_calendarInstance) {
        const workDays = [1,2,3,4,5];
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

function resetWeeklyTasks() {
    if (confirm('是否重置本周任务？')) {
        tasks = [];
        localStorage.removeItem('todos');
        score = 0;
        localStorage.setItem('penalty', '0');
        generateWeeklyTodos();
        displayTasks();
        updateTaskProgress();
        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.innerText = score;
    }
}

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

function addNewTag(type) {
    const name = prompt('标签名称:');
    if (!name) return;
    const color = prompt('颜色 (e.g., #ff0000 或 red):', '#6366f1');
    tags.push({ name, color, associatedItems: [] });
    saveTags();
    populateTagSelects();
}

function updateSelect(type, index, field, value) {
    relations[type][index][field] = value;
    saveData();
    renderLists();
}

function showCalendarDetail(dateStr) {
    const list = document.getElementById('calendarDetailList');
    list.innerHTML = '';
    const events = _calendarInstance.getEvents().filter(e => e.startStr === dateStr);
    events.forEach(ev => {
        const li = document.createElement('li');
        li.innerText = ev.title;
        list.appendChild(li);
    });
    if (events.length === 0) {
        list.innerHTML = '<li>当天无事件</li>';
    }
    document.getElementById('calendarDetailModal').style.display = 'flex';
}

function closeCalendarDetailModal() {
    document.getElementById('calendarDetailModal').style.display = 'none';
}

// AI 任务建议函数（用 Grok API）
function getAISuggestion() {
    const apiKey = 'xai-NGL3t6W1Xs1Y9cjpfwpuXXOEkXP2LtCtoTzFz3TD9bkelJwQTSsKXh8DwePHDWbpKO0RMLgCQQoPjxb9';  // 这里替换成你刚刚创建的 API Key
    const prompt = '作为分析师 CRM App，基于这些客户数据生成 3 个任务建议：' + JSON.stringify(relations.clients.slice(0, 5)); // 示例用前 5 个客户数据

    fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'grok-beta',
            messages: [{ role: 'user', content: prompt }]
        })
    })
    .then(response => response.json())
    .then(data => {
        const suggestion = data.choices[0].message.content;
        alert('Grok AI 建议：\n' + suggestion);
        // 可选：自动加到 tasks
        tasks.push({ name: 'AI 建议任务', suggestion: suggestion, urgency: 50, daysSince: 0, completed: false, type: 'manual', reward: 10 });
        displayTasks();
    })
    .catch(error => {
        console.error('Grok API 错误:', error);
        alert('API 调用失败，请检查密钥或网络');
    });
}