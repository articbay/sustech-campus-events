import {
    cancelEventRegistration,
    createEvent,
    getOwnProfile,
    getOwnRegistrationIds,
    getSessionUser,
    listEvents,
    onAuthStateChange,
    registerForEvent as registerForEventInDatabase,
    removeEvent,
    signIn,
    signOut,
    signUp,
    updateEvent
} from './data-service.js';

const filterOptions = {
    colleges: ['工学院', '理学院', '商学院', '人文社科学院', '环境科学与工程学院'],
    departments: ['计算机科学与工程系', '电子与电气工程系', '材料科学与工程系'],
    collegeSystems: ['致仁书院', '树仁书院', '致诚书院', '树德书院', '致新书院', '树礼书院'],
    clubs: ['英语协会', '机器人社团', '羽毛球协会', '篮球协会', '音乐协会', '摄影协会'],
    categories: ['学术科技', '文化艺术', '体育运动', '语言学习', '职业发展', '志愿服务', '社会实践']
};

let events = [];
let registeredEventIds = new Set();
let currentUser = null;
let currentProfile = null;
let currentSlide = 0;
let slideInterval = null;
let currentMyEventsTab = 'organizing';
let currentFilters = emptyFilters();

const byId = id => document.getElementById(id);
const navHome = byId('nav-home');
const navMyEvents = byId('nav-my-events');
const navCreateEvent = byId('nav-create-event');
const btnLogin = byId('btn-login');
const btnRegister = byId('btn-register');
const btnLogout = byId('btn-logout');
const userName = byId('user-name');
const eventsList = byId('events-list');
const notification = byId('notification');

function emptyFilters() {
    return { college: '', department: '', college_system: '', club: '', category: '', organization: '' };
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function friendlyError(error) {
    const message = error?.message ?? String(error);
    const known = [
        ['Campus identity verification failed', '身份验证失败：姓名、学号/工号和邮箱必须与校园白名单完全一致。'],
        ['Invalid login credentials', '邮箱或密码错误。'],
        ['Email not confirmed', '邮箱尚未确认，请先完成邮箱验证。'],
        ['Already registered', '你已经报名了该活动。'],
        ['Event is full', '活动名额已满。'],
        ['Event has already started', '活动已经开始，无法报名。'],
        ['Registration not found', '未找到对应报名记录。']
    ];
    return known.find(([needle]) => message.includes(needle))?.[1] ?? message;
}

function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    window.setTimeout(() => notification.classList.add('hidden'), 3500);
}

function setBusy(button, busy, idleText) {
    button.disabled = busy;
    button.textContent = busy ? '处理中…' : idleText;
}

function formatDate(dateValue) {
    return new Date(dateValue).toLocaleString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function toDatetimeLocal(dateValue) {
    const date = new Date(dateValue);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function isRegistered(eventId) {
    return registeredEventIds.has(Number(eventId));
}

function filterEvents(source) {
    return source.filter(event => Object.entries(currentFilters).every(([key, value]) => !value || event[key] === value));
}

function renderEvents(source, container = eventsList) {
    if (!source.length) {
        container.innerHTML = '<p class="empty-state">暂无活动</p>';
        return;
    }

    container.innerHTML = source.map(event => {
        const isOrganizer = currentUser && event.organizer_id === currentUser.id;
        const registered = isRegistered(event.id);
        const isFull = event.registered_count >= event.max_attendees;
        const tags = [
            ['category', 'tag-category'],
            ['college', 'tag-college'],
            ['college_system', 'tag-system'],
            ['club', 'tag-club']
        ].filter(([key]) => event[key]).map(([key, className]) =>
            `<span class="tag ${className}">${escapeHtml(event[key])}</span>`
        ).join('');

        return `
            <article class="event-card">
                <h3>${escapeHtml(event.title)}</h3>
                <div class="event-tags">${tags}</div>
                <p>${escapeHtml(event.description)}</p>
                <div class="event-meta">
                    <span>📍 ${escapeHtml(event.location)}</span>
                    <span>📅 ${formatDate(event.event_time)}</span>
                    <span>👥 报名：${event.registered_count}/${event.max_attendees} 人${isFull ? '（已满）' : ''}</span>
                    <span>🏢 机构：${escapeHtml(event.organization)}</span>
                    <span>👤 组织者：${escapeHtml(event.organizer_name)}</span>
                </div>
                <div class="event-actions">
                    <button class="btn btn-primary" data-action="detail" data-event-id="${event.id}">详情</button>
                    ${currentUser && !isOrganizer && !registered && !isFull ? `<button class="btn btn-success" data-action="register" data-event-id="${event.id}">报名参加</button>` : ''}
                    ${currentUser && !isOrganizer && registered ? `<button class="btn btn-danger" data-action="cancel" data-event-id="${event.id}">取消报名</button>` : ''}
                    ${isOrganizer ? `<button class="btn btn-secondary" data-action="edit" data-event-id="${event.id}">编辑</button><button class="btn btn-danger" data-action="delete" data-event-id="${event.id}">删除</button>` : ''}
                </div>
            </article>`;
    }).join('');
}

function renderHome() {
    const filtered = filterEvents(events);
    renderEvents(filtered);
    byId('filter-stats').textContent = `显示 ${filtered.length} / ${events.length} 个活动`;
}

function renderMyEvents() {
    const mine = currentMyEventsTab === 'organizing'
        ? events.filter(event => event.organizer_id === currentUser?.id)
        : events.filter(event => registeredEventIds.has(event.id));
    renderEvents(mine, byId('my-events-list'));
}

async function refreshEvents() {
    events = await listEvents();
    renderHome();
    if (!byId('section-my-events').classList.contains('hidden')) renderMyEvents();
}

async function refreshAuth(user = null) {
    currentUser = user ?? await getSessionUser();
    currentProfile = currentUser ? await getOwnProfile(currentUser.id) : null;
    registeredEventIds = new Set(currentUser ? await getOwnRegistrationIds(currentUser.id) : []);
    updateAuthUI();
    renderHome();
}

function updateAuthUI() {
    btnLogin.classList.toggle('hidden', Boolean(currentUser));
    btnRegister.classList.toggle('hidden', Boolean(currentUser));
    btnLogout.classList.toggle('hidden', !currentUser);
    userName.classList.toggle('hidden', !currentUser);
    userName.textContent = currentProfile?.full_name ?? currentUser?.email ?? '';
}

function openModal(id) {
    byId(id).classList.remove('hidden');
}

function closeModal(id) {
    byId(id).classList.add('hidden');
}

function showSection(name) {
    ['home', 'my-events', 'create-event'].forEach(section => {
        byId(`section-${section}`).classList.toggle('hidden', section !== name);
        byId(`nav-${section}`).classList.toggle('active', section === name);
    });
    if (name === 'my-events') renderMyEvents();
}

function showEventDetail(eventId) {
    const event = events.find(item => item.id === Number(eventId));
    if (!event) return;
    byId('detail-title').textContent = event.title;
    byId('detail-description').textContent = event.description;
    byId('detail-location').textContent = event.location;
    byId('detail-time').textContent = formatDate(event.event_time);
    byId('detail-attendees').textContent = `已报名 ${event.registered_count}/${event.max_attendees} 人`;
    byId('detail-organizer').textContent = `${event.organization} - ${event.organizer_name}`;
    openModal('detail-modal');
}

function openCreateEventModal() {
    if (!currentUser) {
        openModal('auth-modal');
        showNotification('请先登录。', 'error');
        return;
    }
    byId('event-modal-title').textContent = '创建新活动';
    byId('event-form').reset();
    byId('edit-event-id').value = '';
    openModal('event-modal');
}

function editEventForm(eventId) {
    const event = events.find(item => item.id === Number(eventId));
    if (!event || event.organizer_id !== currentUser?.id) return;
    byId('event-modal-title').textContent = '编辑活动';
    byId('edit-event-id').value = event.id;
    byId('event-title').value = event.title;
    byId('event-description').value = event.description;
    byId('event-location').value = event.location;
    byId('event-time').value = toDatetimeLocal(event.event_time);
    byId('event-max-attendees').value = event.max_attendees;
    byId('event-organization').value = event.organization;
    byId('event-category').value = event.category ?? '';
    byId('event-college').value = event.college ?? '';
    byId('event-department').value = event.department ?? '';
    byId('event-college-system').value = event.college_system ?? '';
    byId('event-club').value = event.club ?? '';
    openModal('event-modal');
}

async function handleLogin(event) {
    event.preventDefault();
    const button = event.submitter;
    setBusy(button, true, '登录');
    try {
        await signIn(byId('login-email').value.trim().toLowerCase(), byId('login-password').value);
        closeModal('auth-modal');
        showNotification('登录成功。');
    } catch (error) {
        showNotification(friendlyError(error), 'error');
    } finally {
        setBusy(button, false, '登录');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    const button = event.submitter;
    const password = byId('register-password').value;
    if (password.length < 6) {
        showNotification('密码至少需要6位。', 'error');
        return;
    }
    setBusy(button, true, '注册');
    try {
        const result = await signUp({
            fullName: byId('register-name').value.trim(),
            studentEmployeeId: byId('register-id').value.trim(),
            email: byId('register-email').value.trim().toLowerCase(),
            password
        });
        closeModal('auth-modal');
        showNotification(result.session ? '注册并登录成功。' : '注册成功，请检查邮箱完成确认。');
    } catch (error) {
        showNotification(friendlyError(error), 'error');
    } finally {
        setBusy(button, false, '注册');
    }
}

async function handleEventSubmit(event) {
    event.preventDefault();
    if (!currentUser || !currentProfile) return;
    const button = event.submitter;
    const eventTime = new Date(byId('event-time').value);
    const maxAttendees = Number(byId('event-max-attendees').value);
    if (eventTime.getTime() <= Date.now()) {
        showNotification('活动时间必须晚于当前时间。', 'error');
        return;
    }
    if (!Number.isInteger(maxAttendees) || maxAttendees < 1) {
        showNotification('人数必须为正整数。', 'error');
        return;
    }

    const payload = {
        title: byId('event-title').value.trim(),
        description: byId('event-description').value.trim(),
        location: byId('event-location').value.trim(),
        event_time: eventTime.toISOString(),
        max_attendees: maxAttendees,
        organization: byId('event-organization').value,
        category: byId('event-category').value || null,
        college: byId('event-college').value || null,
        department: byId('event-department').value || null,
        college_system: byId('event-college-system').value || null,
        club: byId('event-club').value || null,
        status: 'published'
    };
    setBusy(button, true, '保存');
    try {
        const editId = Number(byId('edit-event-id').value);
        if (editId) await updateEvent(editId, payload);
        else await createEvent(payload, currentUser.id, currentProfile.full_name);
        closeModal('event-modal');
        await refreshEvents();
        showNotification(editId ? '活动已更新。' : '活动已创建。');
    } catch (error) {
        showNotification(friendlyError(error), 'error');
    } finally {
        setBusy(button, false, '保存');
    }
}

async function handleCardAction(action, eventId) {
    try {
        if (action === 'detail') return showEventDetail(eventId);
        if (!currentUser) {
            openModal('auth-modal');
            return showNotification('请先登录。', 'error');
        }
        if (action === 'edit') return editEventForm(eventId);
        if (action === 'register') await registerForEventInDatabase(eventId);
        if (action === 'cancel') await cancelEventRegistration(eventId);
        if (action === 'delete') {
            if (!window.confirm('确定要删除这个活动吗？')) return;
            await removeEvent(eventId);
        }
        registeredEventIds = new Set(await getOwnRegistrationIds(currentUser.id));
        await refreshEvents();
        showNotification(action === 'register' ? '报名成功。' : action === 'cancel' ? '已取消报名。' : '活动已删除。');
    } catch (error) {
        showNotification(friendlyError(error), 'error');
    }
}

function applyFilters() {
    currentFilters = {
        college: byId('filter-college').value,
        department: byId('filter-department').value,
        college_system: byId('filter-college-system').value,
        club: byId('filter-club').value,
        category: byId('filter-category').value,
        organization: byId('filter-organization').value
    };
    renderHome();
}

function resetFilters() {
    currentFilters = emptyFilters();
    Object.keys(currentFilters).forEach(key => byId(`filter-${key.replace('_', '-')}`).value = '');
    renderHome();
}

function showSlide(index) {
    const slides = [...document.querySelectorAll('.banner-slide')];
    const dots = [...document.querySelectorAll('.banner-dot')];
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, position) => slide.classList.toggle('active', position === currentSlide));
    dots.forEach((dot, position) => dot.classList.toggle('active', position === currentSlide));
    const video = slides[currentSlide]?.querySelector('video');
    if (video) video.play().catch(() => {});
}

function resetSlideInterval() {
    window.clearInterval(slideInterval);
    slideInterval = window.setInterval(() => showSlide(currentSlide + 1), 10000);
}

function changeSlide(direction) {
    showSlide(currentSlide + direction);
    resetSlideInterval();
}

function goToSlide(index) {
    showSlide(index);
    resetSlideInterval();
}

function appendOptions(selectId, values) {
    const select = byId(selectId);
    values.forEach(value => select.add(new Option(value, value)));
}

function initFilters() {
    const mappings = [
        ['filter-college', 'event-college', filterOptions.colleges],
        ['filter-department', 'event-department', filterOptions.departments],
        ['filter-college-system', 'event-college-system', filterOptions.collegeSystems],
        ['filter-club', 'event-club', filterOptions.clubs],
        ['filter-category', 'event-category', filterOptions.categories]
    ];
    mappings.forEach(([filterId, eventId, values]) => {
        appendOptions(filterId, values);
        appendOptions(eventId, values);
    });
}

function bindEvents() {
    navHome.addEventListener('click', () => showSection('home'));
    navMyEvents.addEventListener('click', () => {
        if (!currentUser) {
            openModal('auth-modal');
            showNotification('请先登录。', 'error');
            return;
        }
        showSection('my-events');
    });
    navCreateEvent.addEventListener('click', openCreateEventModal);
    byId('btn-open-create-modal').addEventListener('click', openCreateEventModal);
    btnLogin.addEventListener('click', () => {
        byId('login-form-container').classList.remove('hidden');
        byId('register-form-container').classList.add('hidden');
        openModal('auth-modal');
    });
    btnRegister.addEventListener('click', () => {
        byId('login-form-container').classList.add('hidden');
        byId('register-form-container').classList.remove('hidden');
        openModal('auth-modal');
    });
    btnLogout.addEventListener('click', async () => {
        try {
            await signOut();
            showSection('home');
            showNotification('已登出。');
        } catch (error) {
            showNotification(friendlyError(error), 'error');
        }
    });
    byId('login-form').addEventListener('submit', handleLogin);
    byId('register-form').addEventListener('submit', handleRegister);
    byId('event-form').addEventListener('submit', handleEventSubmit);
    byId('switch-to-register').addEventListener('click', event => {
        event.preventDefault();
        byId('login-form-container').classList.add('hidden');
        byId('register-form-container').classList.remove('hidden');
    });
    byId('switch-to-login').addEventListener('click', event => {
        event.preventDefault();
        byId('login-form-container').classList.remove('hidden');
        byId('register-form-container').classList.add('hidden');
    });
    document.querySelectorAll('.close').forEach(button => button.addEventListener('click', event => {
        event.target.closest('.modal')?.classList.add('hidden');
    }));
    document.querySelectorAll('.modal').forEach(modal => modal.addEventListener('click', event => {
        if (event.target === modal) modal.classList.add('hidden');
    }));
    document.querySelectorAll('.events-grid').forEach(grid => grid.addEventListener('click', event => {
        const button = event.target.closest('[data-action]');
        if (button) handleCardAction(button.dataset.action, Number(button.dataset.eventId));
    }));
    byId('tab-organizing').addEventListener('click', event => {
        currentMyEventsTab = 'organizing';
        event.currentTarget.classList.add('active');
        byId('tab-registered').classList.remove('active');
        renderMyEvents();
    });
    byId('tab-registered').addEventListener('click', event => {
        currentMyEventsTab = 'registered';
        event.currentTarget.classList.add('active');
        byId('tab-organizing').classList.remove('active');
        renderMyEvents();
    });
}

async function init() {
    initFilters();
    bindEvents();
    showSlide(0);
    resetSlideInterval();
    try {
        await refreshEvents();
        await refreshAuth();
        onAuthStateChange(user => refreshAuth(user).catch(error => showNotification(friendlyError(error), 'error')));
    } catch (error) {
        eventsList.innerHTML = '<p class="empty-state">数据加载失败，请稍后重试。</p>';
        showNotification(friendlyError(error), 'error');
    }
}

window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.changeSlide = changeSlide;
window.goToSlide = goToSlide;

init();
