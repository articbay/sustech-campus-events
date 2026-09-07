// ============================================
// SUSTech Campus Events - 脱敏前端原型
// ============================================

// 仅用于本地演示的虚构身份。真实系统应由服务端/Supabase 私有表校验。
const schoolPersonnel = [
    { id: 1, full_name: '演示学生A', student_employee_id: '12400001', email: '12400001@mail.sustech.edu.cn', department: '计算机科学与工程系', college_system: '致仁书院', role: '学生' },
    { id: 2, full_name: '演示学生B', student_employee_id: '12400002', email: '12400002@mail.sustech.edu.cn', department: '商学院', college_system: '树德书院', role: '学生' }
];

// 会话内存储：刷新页面后清空，不代表生产级认证或持久化。
const users = [];

// 演示数据 - 南科大活动
const demoEvents = [
    { id: 1, title: '校园数据创新工作坊', description: '围绕校园场景完成数据分析与可视化实践。', location: '工学院南楼', event_time: '2026-10-18T14:00', max_attendees: 60, organizer_id: 'seed-organizer-1', organizer_name: '数据科学社', organization: '社团联合会', college: '工学院', department: '计算机科学与工程系', college_system: '', club: '', category: '学术科技' },
    { id: 2, title: '致仁书院读书分享会', description: '围绕一本科技人文作品开展小组讨论。', location: '琳恩图书馆', event_time: '2026-10-24T19:00', max_attendees: 30, organizer_id: 'seed-organizer-2', organizer_name: '致仁书院学生会', organization: '致仁书院', college: '', department: '', college_system: '致仁书院', club: '', category: '文化艺术' },
    { id: 3, title: '校园羽毛球友谊赛', description: '面向全校学生的非专业组双打交流赛。', location: '一期体育馆', event_time: '2026-11-01T10:00', max_attendees: 48, organizer_id: 'seed-organizer-3', organizer_name: '羽毛球协会', organization: '社团联合会', college: '', department: '', college_system: '', club: '羽毛球协会', category: '体育运动' },
    { id: 4, title: 'AI 与商业分析讲座', description: '分享人工智能在商业决策与运营分析中的应用。', location: '商学院报告厅', event_time: '2026-11-08T15:00', max_attendees: 120, organizer_id: 'seed-organizer-4', organizer_name: '商学院职业发展中心', organization: '商学院', college: '商学院', department: '', college_system: '', club: '', category: '职业发展' }
];

const registrations = [];

let currentUser = null;
let currentSlide = 0;
let slideInterval = null;
let currentFilters = {
    college: '',
    department: '',
    college_system: '',
    club: '',
    category: '',
    organization: ''
};
let currentMyEventsTab = 'organizing';

// DOM元素
const navHome = document.getElementById('nav-home');
const navMyEvents = document.getElementById('nav-my-events');
const navCreateEvent = document.getElementById('nav-create-event');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userName = document.getElementById('user-name');
const authModal = document.getElementById('auth-modal');
const eventModal = document.getElementById('event-modal');
const detailModal = document.getElementById('detail-modal');
const eventsList = document.getElementById('events-list');
const sectionHome = document.getElementById('section-home');
const sectionMyEvents = document.getElementById('section-my-events');
const sectionCreateEvent = document.getElementById('section-create-event');
const notification = document.getElementById('notification');

// 筛选选项
const filterOptions = {
    colleges: ['工学院', '理学院', '商学院', '人文社科学院', '环境科学与工程学院'],
    departments: ['计算机科学与工程系', '电子与电气工程系', '材料科学与工程系'],
    collegeSystems: ['致仁书院', '树仁书院', '致诚书院', '树德书院', '致新书院', '树礼书院'],
    clubs: ['英语协会', '机器人社团', '羽毛球协会', '篮球协会', '音乐协会', '摄影协会'],
    categories: ['学术科技', '文化艺术', '体育运动', '语言学习', '职业发展', '志愿服务', '社会实践']
};

// 显示通知
function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// 防止用户输入被当作 HTML 执行。
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

// 仅用于当前会话的演示。生产环境由 Supabase Auth 负责密码处理。
async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

// 获取活动报名人数
function getRegistrationCount(eventId) {
    return registrations.filter(r => r.event_id === eventId).length;
}

// 检查用户是否已报名
function isUserRegistered(eventId, userId) {
    return registrations.some(r => r.event_id === eventId && r.user_id === userId);
}

// 获取用户已报名的活动
function getUserRegisteredEvents(userId) {
    const userRegIds = registrations.filter(r => r.user_id === userId).map(r => r.event_id);
    return demoEvents.filter(e => userRegIds.includes(e.id));
}

// 轮播图功能
function showSlide(index) {
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.banner-dot');
    
    if (index >= slides.length) currentSlide = 0;
    if (index < 0) currentSlide = slides.length - 1;
    
    slides.forEach((slide, i) => {
        slide.classList.remove('active');
        dots[i].classList.remove('active');
    });
    
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
    
    const video = slides[currentSlide].querySelector('.banner-video');
    if (video) {
        video.currentTime = 0;
        video.play();
    }
}

function changeSlide(direction) {
    currentSlide += direction;
    showSlide(currentSlide);
    resetSlideInterval();
}

function goToSlide(index) {
    currentSlide = index;
    showSlide(currentSlide);
    resetSlideInterval();
}

window.changeSlide = changeSlide;
window.goToSlide = goToSlide;

// 重置轮播间隔
function resetSlideInterval() {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
    
    const slides = document.querySelectorAll('.banner-slide');
    const isVideoSlide = slides[currentSlide].classList.contains('has-video');
    const intervalTime = isVideoSlide ? 60000 : 10000;
    
    slideInterval = setInterval(() => {
        changeSlide(1);
    }, intervalTime);
}

// 筛选活动
function filterEvents(events) {
    return events.filter(event => {
        if (currentFilters.college && event.college !== currentFilters.college) return false;
        if (currentFilters.department && event.department !== currentFilters.department) return false;
        if (currentFilters.college_system && event.college_system !== currentFilters.college_system) return false;
        if (currentFilters.club && event.club !== currentFilters.club) return false;
        if (currentFilters.category && event.category !== currentFilters.category) return false;
        if (currentFilters.organization && event.organization !== currentFilters.organization) return false;
        return true;
    });
}

// 应用筛选
function applyFilters() {
    currentFilters.college = document.getElementById('filter-college').value;
    currentFilters.department = document.getElementById('filter-department').value;
    currentFilters.college_system = document.getElementById('filter-college-system').value;
    currentFilters.club = document.getElementById('filter-club').value;
    currentFilters.category = document.getElementById('filter-category').value;
    currentFilters.organization = document.getElementById('filter-organization').value;
    
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
    
    const filterStats = document.getElementById('filter-stats');
    filterStats.textContent = `显示 ${filteredEvents.length} / ${demoEvents.length} 个活动`;
}

// 重置筛选
function resetFilters() {
    document.getElementById('filter-college').value = '';
    document.getElementById('filter-department').value = '';
    document.getElementById('filter-college-system').value = '';
    document.getElementById('filter-club').value = '';
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-organization').value = '';
    
    currentFilters = {
        college: '',
        department: '',
        college_system: '',
        club: '',
        category: '',
        organization: ''
    };
    
    renderEvents(demoEvents, eventsList, true);
    document.getElementById('filter-stats').textContent = `显示全部 ${demoEvents.length} 个活动`;
}

window.applyFilters = applyFilters;
window.resetFilters = resetFilters;

// 显示指定部分
function showSection(sectionName) {
    sectionHome.classList.add('hidden');
    sectionMyEvents.classList.add('hidden');
    sectionCreateEvent.classList.add('hidden');
    
    navHome.classList.remove('active');
    navMyEvents.classList.remove('active');
    navCreateEvent.classList.remove('active');
    
    if (sectionName === 'home') {
        sectionHome.classList.remove('hidden');
        navHome.classList.add('active');
        const filteredEvents = filterEvents(demoEvents);
        renderEvents(filteredEvents, eventsList, true);
    } else if (sectionName === 'my-events') {
        if (!currentUser) {
            openModal('auth-modal');
            showNotification('请先登录！', 'error');
            return;
        }
        sectionMyEvents.classList.remove('hidden');
        navMyEvents.classList.add('active');
        renderMyEvents();
    } else if (sectionName === 'create-event') {
        sectionCreateEvent.classList.remove('hidden');
        navCreateEvent.classList.add('active');
    }
}

// 渲染我的活动
function renderMyEvents() {
    const container = document.getElementById('my-events-list');
    let eventsToShow = [];
    
    if (currentMyEventsTab === 'organizing') {
        eventsToShow = demoEvents.filter(e => e.organizer_id === currentUser?.id);
    } else {
        eventsToShow = getUserRegisteredEvents(currentUser?.id);
    }
    
    renderEvents(eventsToShow, container, false);
}

// 渲染活动列表
function renderEvents(events, container, showRegisterBtn) {
    if (events.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#7f8c8d;font-size:1.1rem;padding:3rem;">暂无活动</p>';
        return;
    }
    
    container.innerHTML = events.map(event => {
        const isOrganizer = currentUser && event.organizer_id === currentUser.id;
        const regCount = getRegistrationCount(event.id);
        const isRegistered = currentUser && isUserRegistered(event.id, currentUser.id);
        const isFull = regCount >= event.max_attendees;
        
        let tags = [];
        if (event.category) tags.push(`<span class="tag tag-category">${escapeHtml(event.category)}</span>`);
        if (event.college) tags.push(`<span class="tag tag-college">${escapeHtml(event.college)}</span>`);
        if (event.college_system) tags.push(`<span class="tag tag-system">${escapeHtml(event.college_system)}</span>`);
        if (event.club) tags.push(`<span class="tag tag-club">${escapeHtml(event.club)}</span>`);
        
        return `
            <div class="event-card">
                <h3>${escapeHtml(event.title)}</h3>
                <div class="event-tags">${tags.join('')}</div>
                <p>${escapeHtml(event.description)}</p>
                <div class="event-meta">
                    <span>📍 ${escapeHtml(event.location)}</span>
                    <span>📅 ${formatDate(event.event_time)}</span>
                    <span>👥 报名：${regCount}/${event.max_attendees} 人 ${isFull ? '<strong style="color:#C8102E;">（已满）</strong>' : ''}</span>
                    <span>🏢 机构：${escapeHtml(event.organization)}</span>
                    <span>👤 组织者：${escapeHtml(event.organizer_name)}</span>
                </div>
                <div class="event-actions">
                    <button class="btn btn-primary" onclick="showEventDetail(${event.id})">详情</button>
                    ${showRegisterBtn && currentUser && !isOrganizer && !isRegistered && !isFull ? `<button class="btn btn-success" onclick="registerForEvent(${event.id})">报名参加</button>` : ''}
                    ${showRegisterBtn && currentUser && !isOrganizer && isRegistered ? `<button class="btn btn-danger" onclick="cancelRegistration(${event.id})">取消报名</button>` : ''}
                    ${isOrganizer ? `
                        <button class="btn btn-secondary" onclick="editEvent(${event.id})">编辑</button>
                        <button class="btn btn-danger" onclick="deleteEvent(${event.id})">删除</button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 显示活动详情
function showEventDetail(eventId) {
    const event = demoEvents.find(e => e.id === eventId);
    if (!event) return;
    
    const regCount = getRegistrationCount(eventId);
    
    document.getElementById('detail-title').textContent = event.title;
    document.getElementById('detail-description').textContent = event.description;
    document.getElementById('detail-location').textContent = event.location;
    document.getElementById('detail-time').textContent = formatDate(event.event_time);
    document.getElementById('detail-attendees').textContent = `已报名 ${regCount}/${event.max_attendees} 人`;
    document.getElementById('detail-organizer').textContent = `${event.organization} - ${event.organizer_name}`;
    
    openModal('detail-modal');
}

// 打开模态框
function openModal(modalId) {
    document.getElementById(modalId).classList.remove('hidden');
}

// 关闭模态框
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 更新认证UI
function updateAuthUI() {
    if (currentUser) {
        btnLogin.classList.add('hidden');
        btnRegister.classList.add('hidden');
        btnLogout.classList.remove('hidden');
        userName.classList.remove('hidden');
        userName.textContent = currentUser.full_name || currentUser.email;
    } else {
        btnLogin.classList.remove('hidden');
        btnRegister.classList.remove('hidden');
        btnLogout.classList.add('hidden');
        userName.classList.add('hidden');
    }
}

// 登录处理
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
        showNotification('用户不存在！请先注册。', 'error');
        return;
    }
    
    if (user.password_hash !== await hashPassword(password)) {
        showNotification('密码错误！', 'error');
        return;
    }
    
    // 验证用户仍然在学校人员数据库中
    const personnel = schoolPersonnel.find(p => p.id === user.personnel_id);
    if (!personnel) {
        showNotification('账户已失效，请联系管理员。', 'error');
        return;
    }
    
    currentUser = user;
    updateAuthUI();
    closeModal('auth-modal');
    showNotification('登录成功！');
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
}

// 验证南科大邮箱域名 - 只接受 @mail.sustech.edu.cn 格式
function isValidSustechEmail(email) {
    const emailDomain = email.split('@')[1];
    return emailDomain === 'mail.sustech.edu.cn';
}

// 验证学号/工号 (12开头的8位数字)
function isValidStudentId(id) {
    return /^12\d{6}$/.test(id);
}

// 在学校人员数据库中查找匹配的记录
function findSchoolPersonnel(name, studentEmployeeId, email) {
    return schoolPersonnel.find(person => {
        // 姓名必须匹配（不区分大小写），学号/工号必须匹配，邮箱必须匹配
        const nameMatch = person.full_name.toLowerCase() === name.toLowerCase();
        const idMatch = person.student_employee_id === studentEmployeeId;
        const emailMatch = person.email.toLowerCase() === email.toLowerCase();
        return nameMatch && idMatch && emailMatch;
    });
}

// 注册处理
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim().toLowerCase();
    const studentId = document.getElementById('register-id').value.trim();
    const password = document.getElementById('register-password').value;
    
    // 验证邮箱域名
    if (!isValidSustechEmail(email)) {
        showNotification('请使用 @mail.sustech.edu.cn 格式的演示邮箱注册！', 'error');
        return;
    }
    
    // 验证学号/工号
    if (!isValidStudentId(studentId)) {
        showNotification('学号/工号格式错误！请输入以12开头的8位数字', 'error');
        return;
    }
    
    // 验证是否在学校人员数据库中
    const personnel = findSchoolPersonnel(name, studentId, email);
    if (!personnel) {
        showNotification('身份验证失败！姓名、学号/工号或邮箱与学校记录不匹配。', 'error');
        return;
    }
    
    // 检查是否已经注册
    if (users.find(u => u.email === email)) {
        showNotification('该邮箱已被注册！', 'error');
        return;
    }
    
    if (users.find(u => u.student_employee_id === studentId)) {
        showNotification('该学号/工号已被注册！', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('密码长度至少6位！', 'error');
        return;
    }
    
    const newUser = {
        id: 'user-' + (users.length + 1),
        email: email,
        password_hash: await hashPassword(password),
        full_name: name,
        student_employee_id: studentId,
        personnel_id: personnel.id,
        department: personnel.department,
        college_system: personnel.college_system,
        role: personnel.role
    };
    users.push(newUser);
    
    currentUser = newUser;
    updateAuthUI();
    closeModal('auth-modal');
    showNotification('注册成功！');
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
}

// 登出处理
function handleLogout() {
    currentUser = null;
    updateAuthUI();
    showSection('home');
    showNotification('已登出');
}

// 打开创建活动模态框
function openCreateEventModal() {
    if (!currentUser) {
        openModal('auth-modal');
        showNotification('请先登录！', 'error');
        return;
    }
    document.getElementById('event-modal-title').textContent = '创建新活动';
    document.getElementById('edit-event-id').value = '';
    document.getElementById('event-form').reset();
    openModal('event-modal');
}

// 编辑活动
function editEvent(eventId) {
    const event = demoEvents.find(e => e.id === eventId);
    if (!event) return;
    if (!currentUser || event.organizer_id !== currentUser.id) {
        showNotification('只能编辑自己创建的活动。', 'error');
        return;
    }
    document.getElementById('event-modal-title').textContent = '编辑活动';
    document.getElementById('edit-event-id').value = event.id;
    document.getElementById('event-title').value = event.title;
    document.getElementById('event-description').value = event.description || '';
    document.getElementById('event-location').value = event.location || '';
    document.getElementById('event-time').value = event.event_time || '';
    document.getElementById('event-max-attendees').value = event.max_attendees || '';
    document.getElementById('event-organization').value = event.organization || '';
    document.getElementById('event-category').value = event.category || '';
    document.getElementById('event-college').value = event.college || '';
    document.getElementById('event-department').value = event.department || '';
    document.getElementById('event-college-system').value = event.college_system || '';
    document.getElementById('event-club').value = event.club || '';
    openModal('event-modal');
}

// 保存活动
function handleEventSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        showNotification('请先登录！', 'error');
        return;
    }
    
    const title = document.getElementById('event-title').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const location = document.getElementById('event-location').value.trim();
    const eventTime = document.getElementById('event-time').value;
    const maxAttendees = parseInt(document.getElementById('event-max-attendees').value);
    const organization = document.getElementById('event-organization').value;
    const college = document.getElementById('event-college').value;
    const department = document.getElementById('event-department').value;
    const collegeSystem = document.getElementById('event-college-system').value;
    const club = document.getElementById('event-club').value;
    const category = document.getElementById('event-category').value;
    const editId = document.getElementById('edit-event-id').value;

    if (!title || !location || !eventTime || !Number.isInteger(maxAttendees) || maxAttendees < 1) {
        showNotification('请完整填写活动信息，人数须为正整数。', 'error');
        return;
    }
    if (new Date(eventTime).getTime() <= Date.now()) {
        showNotification('活动时间必须晚于当前时间。', 'error');
        return;
    }
    
    if (editId) {
        const event = demoEvents.find(e => e.id === parseInt(editId));
        if (event && event.organizer_id === currentUser.id) {
            event.title = title;
            event.description = description;
            event.location = location;
            event.event_time = eventTime;
            event.max_attendees = maxAttendees;
            event.organization = organization;
            event.college = college;
            event.department = department;
            event.college_system = collegeSystem;
            event.club = club;
            event.category = category;
        } else {
            showNotification('只能更新自己创建的活动。', 'error');
            return;
        }
        showNotification('活动更新成功！');
    } else {
        const newEvent = {
            id: Math.max(0, ...demoEvents.map(event => event.id)) + 1,
            title: title,
            description: description,
            location: location,
            event_time: eventTime,
            max_attendees: maxAttendees,
            organization: organization,
            college: college,
            department: department,
            college_system: collegeSystem,
            club: club,
            category: category,
            organizer_id: currentUser.id,
            organizer_name: currentUser.full_name
        };
        demoEvents.unshift(newEvent);
        showNotification('活动创建成功！');
    }
    
    closeModal('event-modal');
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
}

// 删除活动
function deleteEvent(eventId) {
    const event = demoEvents.find(e => e.id === eventId);
    if (!currentUser || !event || event.organizer_id !== currentUser.id) {
        showNotification('只能删除自己创建的活动。', 'error');
        return;
    }
    if (!confirm('确定要删除这个活动吗？')) return;
    
    let regIndex = registrations.findIndex(r => r.event_id === eventId);
    while (regIndex > -1) {
        registrations.splice(regIndex, 1);
        regIndex = registrations.findIndex(r => r.event_id === eventId);
    }
    
    const eventIndex = demoEvents.findIndex(e => e.id === eventId);
    if (eventIndex > -1) {
        demoEvents.splice(eventIndex, 1);
    }
    
    showNotification('活动已删除');
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
}

// 报名活动
function registerForEvent(eventId) {
    if (!currentUser) {
        openModal('auth-modal');
        showNotification('请先登录！', 'error');
        return;
    }
    
    const event = demoEvents.find(e => e.id === eventId);
    if (!event) {
        showNotification('活动不存在。', 'error');
        return;
    }
    if (new Date(event.event_time).getTime() <= Date.now()) {
        showNotification('该活动已结束，无法报名。', 'error');
        return;
    }
    if (event.organizer_id === currentUser.id) {
        showNotification('不能报名自己创建的活动。', 'error');
        return;
    }
    const regCount = getRegistrationCount(eventId);
    if (regCount >= event.max_attendees) {
        showNotification('报名人数已满！', 'error');
        return;
    }
    
    if (isUserRegistered(eventId, currentUser.id)) {
        showNotification('您已经报名了此活动！', 'error');
        return;
    }
    
    registrations.push({
        event_id: eventId,
        user_id: currentUser.id,
        user_name: currentUser.full_name
    });
    
    showNotification('报名成功！');
    const filteredEvents = filterEvents(demoEvents);
    renderEvents(filteredEvents, eventsList, true);
}

// 取消报名
function cancelRegistration(eventId) {
    if (!currentUser) {
        showNotification('请先登录！', 'error');
        return;
    }
    
    const indexToRemove = registrations.findIndex(
        r => r.event_id === eventId && r.user_id === currentUser.id
    );
    
    if (indexToRemove > -1) {
        registrations.splice(indexToRemove, 1);
        showNotification('已取消报名！');
        const filteredEvents = filterEvents(demoEvents);
        renderEvents(filteredEvents, eventsList, true);
    } else {
        showNotification('您未报名此活动！', 'error');
    }
}

// 全局函数
window.showEventDetail = showEventDetail;
window.registerForEvent = registerForEvent;
window.cancelRegistration = cancelRegistration;
window.editEvent = editEvent;
window.deleteEvent = deleteEvent;

// ============================================
// 事件监听器
// ============================================

// 导航按钮
navHome.addEventListener('click', function() {
    showSection('home');
});

navMyEvents.addEventListener('click', function() {
    showSection('my-events');
});

navCreateEvent.addEventListener('click', function() {
    openCreateEventModal();
});

// 认证按钮
btnLogin.addEventListener('click', function() {
    document.getElementById('login-form-container').classList.remove('hidden');
    document.getElementById('register-form-container').classList.add('hidden');
    openModal('auth-modal');
});

btnRegister.addEventListener('click', function() {
    document.getElementById('login-form-container').classList.add('hidden');
    document.getElementById('register-form-container').classList.remove('hidden');
    openModal('auth-modal');
});

btnLogout.addEventListener('click', handleLogout);

// 表单提交
document.getElementById('login-form').addEventListener('submit', handleLogin);
document.getElementById('register-form').addEventListener('submit', handleRegister);
document.getElementById('event-form').addEventListener('submit', handleEventSubmit);

// 切换表单
document.getElementById('switch-to-register').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('login-form-container').classList.add('hidden');
    document.getElementById('register-form-container').classList.remove('hidden');
});

document.getElementById('switch-to-login').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('login-form-container').classList.remove('hidden');
    document.getElementById('register-form-container').classList.add('hidden');
});

// 关闭模态框
document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.add('hidden');
    });
});

document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
        if (e.target === modal) modal.classList.add('hidden');
    });
});

// 标签切换
document.getElementById('tab-organizing').addEventListener('click', function() {
    this.classList.add('active');
    document.getElementById('tab-registered').classList.remove('active');
    currentMyEventsTab = 'organizing';
    renderMyEvents();
});

document.getElementById('tab-registered').addEventListener('click', function() {
    document.getElementById('tab-organizing').classList.remove('active');
    this.classList.add('active');
    currentMyEventsTab = 'registered';
    renderMyEvents();
});

// 创建活动按钮
document.getElementById('btn-open-create-modal').addEventListener('click', openCreateEventModal);

// ============================================
// 初始化
// ============================================

updateAuthUI();
showSlide(0);
resetSlideInterval();

// 初始化筛选器
function initFilters() {
    const filterCollege = document.getElementById('filter-college');
    const filterDept = document.getElementById('filter-department');
    const filterSystem = document.getElementById('filter-college-system');
    const filterClub = document.getElementById('filter-club');
    const filterCategory = document.getElementById('filter-category');
    
    filterOptions.colleges.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filterCollege.appendChild(option);
    });
    
    filterOptions.departments.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        filterDept.appendChild(option);
    });
    
    filterOptions.collegeSystems.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        filterSystem.appendChild(option);
    });
    
    filterOptions.clubs.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filterClub.appendChild(option);
    });
    
    filterOptions.categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        filterCategory.appendChild(option);
    });
    
    const eventCollege = document.getElementById('event-college');
    const eventDept = document.getElementById('event-department');
    const eventSystem = document.getElementById('event-college-system');
    const eventClub = document.getElementById('event-club');
    const eventCategory = document.getElementById('event-category');
    
    filterOptions.colleges.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        eventCollege.appendChild(option);
    });
    
    filterOptions.departments.forEach(d => {
        const option = document.createElement('option');
        option.value = d;
        option.textContent = d;
        eventDept.appendChild(option);
    });
    
    filterOptions.collegeSystems.forEach(s => {
        const option = document.createElement('option');
        option.value = s;
        option.textContent = s;
        eventSystem.appendChild(option);
    });
    
    filterOptions.clubs.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        eventClub.appendChild(option);
    });
    
    filterOptions.categories.forEach(c => {
        const option = document.createElement('option');
        option.value = c;
        option.textContent = c;
        eventCategory.appendChild(option);
    });
    
    document.getElementById('filter-stats').textContent = `显示全部 ${demoEvents.length} 个活动`;
}

// 初始化筛选器
initFilters();
const filteredEvents = filterEvents(demoEvents);
renderEvents(filteredEvents, eventsList, true);
