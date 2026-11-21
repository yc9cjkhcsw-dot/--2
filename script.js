/* =========================================================
   КАЛЬКУЛЯТОР ЗАРПЛАТЫ
   - Валидация 4 типов ошибок
   - Расчёт: оклад/норма*отработано + премия - НДФЛ
   - Журнал в localStorage
   ========================================================= */

(function () {
    'use strict';

    const STORAGE_KEY = 'salaryJournal_v1';

    const FIELDS = ['salary', 'worked', 'norm', 'bonus', 'tax'];
    const FIELD_LABELS = {
        salary: 'Оклад',
        worked: 'Отработано дней',
        norm: 'Норма дней',
        bonus: 'Премия',
        tax: 'Ставка НДФЛ'
    };

    const form = document.getElementById('calcForm');
    const resultBox = document.getElementById('result');
    const journalList = document.getElementById('journalList');
    const clearBtn = document.getElementById('clearJournal');

    /* ---------- ВАЛИДАЦИЯ ОДНОГО ПОЛЯ ---------- */
    function validateField(rawValue) {
        const trimmed = (rawValue ?? '').trim();
        if (trimmed === '') return '[пустота]';

        const num = Number(trimmed);
        if (Number.isNaN(num)) return '[не цифра]';
        if (num === 0)         return '[нолик]';
        if (num < 0)           return '[отрицание]';

        return null; // всё ок
    }

    /* ---------- ОТОБРАЖЕНИЕ ОШИБОК ПОД ПОЛЯМИ ---------- */
    function showFieldErrors(errors) {
        FIELDS.forEach(name => {
            const input = document.getElementById(name);
            const errSpan = document.querySelector(`.error[data-for="${name}"]`);
            const wrapper = input.closest('.field');
            const msg = errors[name];

            if (msg) {
                errSpan.textContent = msg;
                wrapper.classList.add('has-error');
            } else {
                errSpan.textContent = '';
                wrapper.classList.remove('has-error');
            }
        });
    }

    /* ---------- ФОРМАТИРОВАНИЕ ДЕНЕГ ---------- */
    function formatMoney(n) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(n) + ' ₽';
    }

    /* ---------- РАСЧЁТ ---------- */
    function calculate(values) {
        const salary  = Number(values.salary);
        const worked  = Number(values.worked);
        const norm    = Number(values.norm);
        const bonus   = Number(values.bonus);
        const taxPct  = Number(values.tax);

        if (norm === 0) {
            // На случай если пользователь ввёл 0 — но мы это уже отловили валидацией.
            return null;
        }

        const base      = (salary / norm) * worked;
        const accrued   = base + bonus;
        const ndfl      = accrued * (taxPct / 100);
        const net       = accrued - ndfl;

        return { base, accrued, ndfl, net };
    }

    /* ---------- ОБРАБОТКА ОТПРАВКИ ФОРМЫ ---------- */
    function onSubmit(e) {
        e.preventDefault();

        // 1. Собираем значения и валидируем
        const values = {};
        const errors = {};
        let hasErrors = false;

        FIELDS.forEach(name => {
            const raw = document.getElementById(name).value;
            values[name] = raw;
            const err = validateField(raw);
            if (err) {
                errors[name] = err;
                hasErrors = true;
            }
        });

        showFieldErrors(errors);

        // 2. Если есть ошибки — показываем блок-ошибку, журнал НЕ пополняем
        if (hasErrors) {
            resultBox.classList.remove('hidden', 'error-state');
            resultBox.classList.add('error-state');
            resultBox.innerHTML = `
                <h3>⚠️ Исправьте ошибки в полях</h3>
                <p style="margin:0;color:#991b1b;">Расчёт невозможен, пока все поля не станут корректными числами &gt; 0.</p>
            `;
            return;
        }

        // 3. Считаем
        const result = calculate(values);
        if (!result) return;

        // 4. Показываем результат
        resultBox.classList.remove('hidden', 'error-state');
        resultBox.innerHTML = `
            <h3>✅ Результат расчёта</h3>
            <div class="result-grid">
                <div class="result-item">
                    <span class="label">База (оклад за отработанные дни)</span>
                    <span class="value">${formatMoney(result.base)}</span>
                </div>
                <div class="result-item">
                    <span class="label">Начислено всего (с премией)</span>
                    <span class="value">${formatMoney(result.accrued)}</span>
                </div>
                <div class="result-item">
                    <span class="label">НДФЛ (${values.tax}%)</span>
                    <span class="value">${formatMoney(result.ndfl)}</span>
                </div>
                <div class="result-item highlight">
                    <span class="label">💵 На руки</span>
                    <span class="value">${formatMoney(result.net)}</span>
                </div>
            </div>
        `;

        // 5. Добавляем запись в журнал
        addJournalEntry({
            time: formatTime(new Date()),
            inputs: { ...values },
            result: {
                base:    result.base,
                accrued: result.accrued,
                ndfl:    result.ndfl,
                net:     result.net
            }
        });
    }

    /* ---------- ЖУРНАЛ ---------- */
    function loadJournal() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.warn('Не удалось прочитать журнал:', err);
            return [];
        }
    }

    function saveJournal(list) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        } catch (err) {
            console.warn('Не удалось сохранить журнал:', err);
        }
    }

    function addJournalEntry(entry) {
        const list = loadJournal();
        list.push(entry);          // новые — ВНИЗ списка
        saveJournal(list);
        renderJournal();
    }

    function renderJournal() {
        const list = loadJournal();

        if (list.length === 0) {
            journalList.innerHTML = `<p class="empty">Журнал пока пуст. Сделайте первый расчёт.</p>`;
            return;
        }

        const html = list.map((item, idx) => {
            const inputs = item.inputs;
            return `
                <article class="journal-entry">
                    <div class="time">Запрос #${idx + 1} · ${item.time}</div>
                    <div class="data">
                        <b>${FIELD_LABELS.salary}:</b> ${escapeHtml(inputs.salary)} ·
                        <b>${FIELD_LABELS.worked}:</b> ${escapeHtml(inputs.worked)} ·
                        <b>${FIELD_LABELS.norm}:</b> ${escapeHtml(inputs.norm)} ·
                        <b>${FIELD_LABELS.bonus}:</b> ${escapeHtml(inputs.bonus)} ·
                        <b>${FIELD_LABELS.tax}:</b> ${escapeHtml(inputs.tax)}%
                    </div>
                    <div class="total">
                        Начислено: ${formatMoney(item.result.accrued)} ·
                        НДФЛ: ${formatMoney(item.result.ndfl)} ·
                        На руки: ${formatMoney(item.result.net)}
                    </div>
                </article>
            `;
        }).join('');

        journalList.innerHTML = html;
    }

    function clearJournal() {
        if (!confirm('Удалить все записи журнала?')) return;
        localStorage.removeItem(STORAGE_KEY);
        renderJournal();
    }

    /* ---------- УТИЛИТЫ ---------- */
    function formatTime(d) {
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
               `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ---------- ИНИЦИАЛИЗАЦИЯ ---------- */
    form.addEventListener('submit', onSubmit);
    clearBtn.addEventListener('click', clearJournal);

    // Сбрасываем подсветку ошибок при вводе
    FIELDS.forEach(name => {
        const input = document.getElementById(name);
        input.addEventListener('input', () => {
            const errSpan = document.querySelector(`.error[data-for="${name}"]`);
            errSpan.textContent = '';
            input.closest('.field').classList.remove('has-error');
        });
    });

    // Рендерим журнал при загрузке (восстановление после F5)
    renderJournal();
})();
