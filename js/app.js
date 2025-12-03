/**
 * Daily Task Reminder - Enterprise SPA
 * 
 * Modules:
 * 1. Persistence (IndexedDB)
 * 2. NotificationManager (Speech + Notifications API)
 * 3. TaskManager (CRUD)
 * 4. Scheduler (Escalation Engine)
 * 5. UI (Rendering & Events)
 */

// --- 1. Persistence Layer ---
const DB_NAME = 'DailyTasksDB';
const DB_VERSION = 1;

class Persistence {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (event) => reject('Database error: ' + event.target.errorCode);
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('tasks')) {
                    const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
                    taskStore.createIndex('dueTime', 'dueTime', { unique: false });
                }
                if (!db.objectStoreNames.contains('state')) {
                    db.createObjectStore('state', { keyPath: 'key' });
                }
            };
        });
    }

    async getAllTasks() {
        return this._transaction('tasks', 'readonly', store => store.getAll());
    }

    async saveTask(task) {
        return this._transaction('tasks', 'readwrite', store => store.put(task));
    }

    async deleteTask(id) {
        return this._transaction('tasks', 'readwrite', store => store.delete(id));
    }

    async getState(key) {
        return this._transaction('state', 'readonly', store => store.get(key));
    }

    async saveState(key, value) {
        return this._transaction('state', 'readwrite', store => store.put({ key, value }));
    }

    _transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], mode);
            const store = transaction.objectStore(storeName);
            const request = callback(store);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// --- 2. Notification Manager ---
class NotificationManager {
    constructor() {
        this.voices = [];
        this.selectedVoice = null;
        this.initSpeech();
    }

    initSpeech() {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => {
                this.voices = window.speechSynthesis.getVoices();
                // Prefer a decent English voice
                this.selectedVoice = this.voices.find(v => v.name.includes('Google US English')) || 
                                     this.voices.find(v => v.lang.startsWith('en')) || 
                                     this.voices[0];
                this.populateVoiceSelect();
            };
        }
    }

    populateVoiceSelect() {
        const select = document.getElementById('setting-voice');
        if (!select) return;
        select.innerHTML = '';
        this.voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            select.appendChild(option);
        });
        
        // Set selected
        if (this.selectedVoice) {
            const index = this.voices.indexOf(this.selectedVoice);
            if (index > -1) select.value = index;
        }

        select.onchange = (e) => {
            this.selectedVoice = this.voices[e.target.value];
        };
    }

    async requestPermissions() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission;
        }
        return 'denied';
    }

    async notify(title, body, tag) {
        if (Notification.permission === 'granted') {
            // Try Service Worker first
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                reg.showNotification(title, { body, tag, icon: '/icon.png', vibrate: [200, 100, 200] });
            } else {
                new Notification(title, { body, tag });
            }
        }
    }

    speak(text, level = 1) {
        if (!('speechSynthesis' in window)) return;

        // Cancel current speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        if (this.selectedVoice) utterance.voice = this.selectedVoice;

        // Escalation params
        if (level === 1) {
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 1;
        } else if (level === 2) {
            // Little Angry / Firm
            utterance.rate = 1.1; 
            utterance.pitch = 0.9; 
            utterance.volume = 1;
        } else if (level >= 3) {
            // Angry / Serious
            utterance.rate = 0.85; 
            utterance.pitch = 0.7; 
            utterance.volume = 1;
        }

        window.speechSynthesis.speak(utterance);
    }
}

// --- 3. Task Manager ---
class TaskManager {
    constructor(db) {
        this.db = db;
        this.tasks = [];
    }

    async loadTasks() {
        this.tasks = await this.db.getAllTasks();
        return this.tasks;
    }

    async addTask(taskData) {
        const task = {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedInstances: [], // Array of date strings 'YYYY-MM-DD'
            escalation: {
                intervalMinutes: taskData.intervalMinutes || 5, // Default 5 minutes
                maxSteps: 3
            },
            ...taskData
        };
        await this.db.saveTask(task);
        await this.loadTasks();
        return task;
    }

    async updateTask(task) {
        task.updatedAt = new Date().toISOString();
        await this.db.saveTask(task);
        await this.loadTasks();
    }

    async deleteTask(id) {
        await this.db.deleteTask(id);
        await this.loadTasks();
    }

    async toggleComplete(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        const today = new Date().toISOString().split('T')[0];
        if (task.completedInstances.includes(today)) {
            task.completedInstances = task.completedInstances.filter(d => d !== today);
        } else {
            task.completedInstances.push(today);
        }
        await this.updateTask(task);
    }

    isCompletedToday(task) {
        const today = new Date().toISOString().split('T')[0];
        return task.completedInstances.includes(today);
    }
}

// --- 4. Scheduler ---
class Scheduler {
    constructor(taskManager, notificationManager, db) {
        this.taskManager = taskManager;
        this.notificationManager = notificationManager;
        this.db = db;
        this.intervalId = null;
    }

    start() {
        // Check every minute
        this.intervalId = setInterval(() => this.checkReminders(), 60000);
        this.checkReminders(); // Initial check
    }

    async checkReminders() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
        const todayDate = now.toISOString().split('T')[0];

        const tasks = await this.taskManager.loadTasks();
        const alertState = (await this.db.getState('alertState'))?.value || {};
        let stateChanged = false;

        for (const task of tasks) {
            // Skip if completed today
            if (this.taskManager.isCompletedToday(task)) {
                // Clear alert state if exists
                if (alertState[task.id]) {
                    delete alertState[task.id];
                    stateChanged = true;
                }
                continue;
            }

            // Check if due time has passed today
            // Simple comparison: if currentTime >= dueTime
            // In a real app, we'd handle timezones and exact triggers better
            if (currentTimeStr >= task.dueTime) {
                const lastAlert = alertState[task.id] || { level: 0, lastTime: 0 };
                const lastAlertTime = new Date(lastAlert.lastTime || 0);
                const minutesSinceLast = (now - lastAlertTime) / 60000;

                // Logic:
                // If level 0 (never alerted today), alert immediately
                // If level > 0, check interval
                
                // Reset level if it's a new day (simplified logic: if last alert was yesterday)
                // But here we assume we clear state on completion or daily reset. 
                // For MVP, let's just check if we need to escalate.

                if (lastAlert.level === 0 || minutesSinceLast >= task.escalation.intervalMinutes) {
                    const nextLevel = Math.min(lastAlert.level + 1, task.escalation.maxSteps);
                    
                    // Don't re-alert if we are already at max level and just alerted recently?
                    // Requirement says: "repeated notifications until dismissed or completed" for angry mode.
                    // So we keep alerting at max level.

                    this.triggerAlert(task, nextLevel);
                    
                    alertState[task.id] = {
                        level: nextLevel,
                        lastTime: now.getTime()
                    };
                    stateChanged = true;
                }
            }
        }

        if (stateChanged) {
            await this.db.saveState('alertState', alertState);
        }
    }

    triggerAlert(task, level) {
        console.log(`Triggering alert level ${level} for ${task.title}`);
        
        let message = `Reminder: ${task.title}`;
        let tone = 'neutral';

        if (level === 2) {
            message = `Attention: You have not completed ${task.title}. Please do it now.`;
            tone = 'firm';
        } else if (level >= 3) {
            message = `Urgent! ${task.title} is overdue. Complete it immediately!`;
            tone = 'angry';
        }

        // Visual Notification
        this.notificationManager.notify(
            level >= 3 ? `URGENT: ${task.title}` : task.title,
            message,
            task.id
        );

        // Voice Alert
        this.notificationManager.speak(message, level);
    }
}

// --- 5. UI Controller ---
class App {
    constructor() {
        this.db = new Persistence();
        this.notificationManager = new NotificationManager();
        this.taskManager = null;
        this.scheduler = null;
        
        this.ui = {
            taskList: document.getElementById('task-list'),
            modal: document.getElementById('task-modal'),
            settingsModal: document.getElementById('settings-modal'),
            form: document.getElementById('task-form'),
            btnAdd: document.getElementById('btn-add-task'),
            btnSettings: document.getElementById('btn-settings'),
            btnCancel: document.getElementById('btn-cancel-task'),
            permissionBanner: document.getElementById('permission-banner'),
            btnEnablePermissions: document.getElementById('btn-enable-permissions'),
            filterBtns: document.querySelectorAll('.filter-btn')
        };

        this.currentFilter = 'all';
    }

    async init() {
        await this.db.init();
        this.taskManager = new TaskManager(this.db);
        this.scheduler = new Scheduler(this.taskManager, this.notificationManager, this.db);

        this.bindEvents();
        this.checkPermissions();
        this.renderTasks();
        this.scheduler.start();

        // Register Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('SW registered', reg))
                .catch(err => console.error('SW failed', err));
        }

        // Attempt to register for push notifications (no-op if server not configured)
        // Will be invoked when user clicks enable; keep function available
    }

    bindEvents() {
        this.ui.btnAdd.onclick = () => {
            this.ui.form.reset();
            document.getElementById('task-id').value = '';
            this.ui.modal.showModal();
        };

        this.ui.btnSettings.onclick = () => {
            this.ui.settingsModal.showModal();
        };

        this.ui.btnCancel.onclick = () => {
            this.ui.modal.close();
        };

        this.ui.form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = {
                title: document.getElementById('task-title').value,
                dueTime: document.getElementById('task-time').value,
                priority: document.getElementById('task-priority').value,
                recurrence: document.querySelector('input[name="recurrence"]:checked').value,
                intervalMinutes: parseInt(document.getElementById('task-interval').value, 10)
            };
            
            const id = document.getElementById('task-id').value;
            if (id) {
                const task = this.taskManager.tasks.find(t => t.id === id);
                Object.assign(task, formData);
                // Update nested escalation object if needed
                task.escalation.intervalMinutes = formData.intervalMinutes;
                await this.taskManager.updateTask(task);
            } else {
                await this.taskManager.addTask(formData);
            }
            
            this.ui.modal.close();
            this.renderTasks();
        };

        this.ui.btnEnablePermissions.onclick = async () => {
            const result = await this.notificationManager.requestPermissions();
            if (result === 'granted') {
                this.ui.permissionBanner.classList.add('hidden');
                // Also register push subscription and send to server (if available)
                try {
                    await this.registerPush();
                } catch (e) {
                    console.warn('Push registration failed', e);
                }
            }
        };

        this.ui.filterBtns.forEach(btn => {
            btn.onclick = (e) => {
                this.ui.filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderTasks();
            };
        });
    }

    // Register push subscription and send to backend
    async registerPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            console.warn('Push not supported in this browser');
            return;
        }

        const reg = await navigator.serviceWorker.ready;
        // VAPID public key should come from your server; placeholder below
        const VAPID_PUBLIC_KEY = window.VAPID_PUBLIC_KEY || null;
        if (!VAPID_PUBLIC_KEY) {
            console.warn('No VAPID public key set. Provide one on the page as window.VAPID_PUBLIC_KEY');
        }

        try {
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: VAPID_PUBLIC_KEY ? this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY) : undefined
            });

            // Send subscription to server for storage (server endpoint must be implemented)
            await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub })
            });
            console.log('Push subscribed and sent to server');
        } catch (e) {
            console.warn('Failed to subscribe to push', e);
        }
    }

    urlBase64ToUint8Array(base64String) {
        // Utility to convert VAPID key
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    checkPermissions() {
        if (Notification.permission !== 'granted') {
            this.ui.permissionBanner.classList.remove('hidden');
        }
    }

    async renderTasks() {
        const tasks = await this.taskManager.loadTasks();
        this.ui.taskList.innerHTML = '';

        if (tasks.length === 0) {
            this.ui.taskList.innerHTML = '<li class="empty-state">No tasks yet. Add one!</li>';
            return;
        }

        const filteredTasks = tasks.filter(task => {
            const isCompleted = this.taskManager.isCompletedToday(task);
            if (this.currentFilter === 'pending') return !isCompleted;
            if (this.currentFilter === 'completed') return isCompleted;
            return true;
        });

        filteredTasks.forEach(task => {
            const isCompleted = this.taskManager.isCompletedToday(task);
            const li = document.createElement('li');
            li.className = `task-item ${isCompleted ? 'completed' : ''}`;
            
            li.innerHTML = `
                <div class="task-info">
                    <h3>${task.title}</h3>
                    <div class="task-meta">
                        <span>⏰ ${task.dueTime}</span>
                        <span>🔁 ${task.recurrence}</span>
                        ${task.priority === 'high' ? '<span style="color:var(--danger-color)">🔥 High</span>' : ''}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick="window.app.toggleTask('${task.id}')" title="${isCompleted ? 'Undo' : 'Complete'}">
                        ${isCompleted ? '↩️' : '✅'}
                    </button>
                    <button class="btn-icon" onclick="window.app.editTask('${task.id}')" title="Edit">✏️</button>
                    <button class="btn-icon" onclick="window.app.deleteTask('${task.id}')" title="Delete">🗑️</button>
                </div>
            `;
            this.ui.taskList.appendChild(li);
        });
    }

    // Exposed for HTML onclick handlers
    async toggleTask(id) {
        await this.taskManager.toggleComplete(id);
        this.renderTasks();
    }

    async deleteTask(id) {
        if (confirm('Delete this task?')) {
            await this.taskManager.deleteTask(id);
            this.renderTasks();
        }
    }

    editTask(id) {
        const task = this.taskManager.tasks.find(t => t.id === id);
        if (!task) return;

        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-time').value = task.dueTime;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-interval').value = task.escalation?.intervalMinutes || 5;
        // Handle radio
        const radio = document.querySelector(`input[name="recurrence"][value="${task.recurrence}"]`);
        if (radio) radio.checked = true;

        this.ui.modal.showModal();
    }
}

// Initialize
window.app = new App();
window.addEventListener('DOMContentLoaded', () => window.app.init());
