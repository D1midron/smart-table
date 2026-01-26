import {cloneTemplate} from "../lib/utils.js";

/**
 * Инициализирует таблицу и вызывает коллбэк при любых изменениях и нажатиях на кнопки
 *
 * @param {Object} settings
 * @param {(action: HTMLButtonElement | undefined) => void} onAction
 * @returns {{container: Node, elements: *, render: render}}
 */
export function initTable(settings, onAction) {
    const {tableTemplate, rowTemplate, before, after} = settings;
    const root = cloneTemplate(tableTemplate);

    const mergeElements = (from) => {
        Object.keys(from).forEach((key) => {
            if (!(key in root.elements)) {
                root.elements[key] = from[key];
            }
        });
    };

    const insertTemplates = (templateIds, position) => {
        templateIds.forEach((templateId) => {
            const block = cloneTemplate(templateId);
            mergeElements(block.elements);

            if (position === 'before') {
                root.container.insertBefore(block.container, root.elements.rows);
            } else {
                root.container.appendChild(block.container);
            }
        });
    };

    // Дополнительные шаблоны (например, header) до/после таблицы
    insertTemplates(before ?? [], 'before');
    insertTemplates(after ?? [], 'after');

    // События (кнопки submit + ввод в фильтры)
    root.container.addEventListener('submit', (e) => {
        e.preventDefault();
        onAction?.(e.submitter);
    });

    root.container.addEventListener('input', (e) => {
        const target = e.target;
        if (!target) return;

        if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
            onAction?.(target);
        }
    });

    root.container.addEventListener('change', (e) => {
        const target = e.target;
        if (!target) return;

        if (target.tagName === 'SELECT') {
            onAction?.(target);
        }
    });

    const render = (data) => {
        const rows = Array.isArray(data) ? data : [];
        const nextRows = rows.map((row) => {
            const rowEl = cloneTemplate(rowTemplate);

            Object.keys(rowEl.elements).forEach((key) => {
                if (rowEl.elements[key] && key in row) {
                    rowEl.elements[key].textContent = String(row[key] ?? '');
                }
            });

            return rowEl.container;
        });
        root.elements.rows.replaceChildren(...nextRows);
    }

    return {...root, render};
}