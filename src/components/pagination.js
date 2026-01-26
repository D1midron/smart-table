import {getPages} from "../lib/utils.js";

export const initPagination = ({pages, fromRow, toRow, totalRows}, createPage) => {
    pages.replaceChildren();

    let pageCount = 1;
    const MAX_VISIBLE_PAGES = 5;

    const getActionName = (action) => {
        if (!action) return null;
        if (action.tagName === 'BUTTON') return action.name;
        if (action.tagName === 'INPUT' || action.tagName === 'SELECT') return action.name;
        return null;
    };

    const applyPagination = (query, state, action) => {
        const actionName = getActionName(action);

        const limit = Math.max(1, Number(state.rowsPerPage || 10));
        let page = Math.max(1, Number(state.page || 1));

        const paginationActions = new Set(['first', 'prev', 'next', 'last', 'page', 'rowsPerPage']);
        
        
        if (actionName && !paginationActions.has(actionName)) {
            page = 1;
        }

        if (actionName === 'rowsPerPage') {
            page = 1;
        }

        if (actionName === 'page') {
            page = Math.max(1, Number(action.value || 1));
        }

        if (actionName === 'first') page = 1;
        if (actionName === 'prev') page = page - 1;
        if (actionName === 'next') page = page + 1;
        if (actionName === 'last') {
            // pageCount будет вычислен в updatePagination, но для last мы используем большое число
            // и потом скорректируем в updatePagination
            page = 999999;
        }

        // Не ограничиваем pageCount здесь, так как он еще не известен
        // Ограничение произойдет в updatePagination
        page = Math.max(1, page);

        return Object.assign({}, query, { // добавим параметры к query, но не изменяем исходный объект
            limit,
            page
        });
    }

    const updatePagination = (total, { page, limit }) => {
        const safeLimit = Math.max(1, Number(limit || 10));
        let safePage = Math.max(1, Number(page || 1));
        const safeTotal = Math.max(0, Number(total || 0));

        pageCount = Math.max(1, Math.ceil(safeTotal / safeLimit));

        // Если была нажата кнопка "last" (page = 999999), устанавливаем на последнюю страницу
        if (safePage >= 999999) {
            safePage = pageCount;
        }

        const clampedPage = Math.min(pageCount, safePage);
        const hasRows = safeTotal > 0;

        const start = hasRows ? (clampedPage - 1) * safeLimit + 1 : 0;
        const end = hasRows ? Math.min(safeTotal, clampedPage * safeLimit) : 0;

        fromRow.textContent = String(start);
        toRow.textContent = String(end);
        totalRows.textContent = String(safeTotal);

        const nextPages = getPages(clampedPage, pageCount, Math.min(MAX_VISIBLE_PAGES, pageCount));
        const pageButtons = nextPages.map((pageNumber) => {
            const label = createPage(pageNumber);
            const input = label.querySelector('input[name="page"]');
            if (input) {
                input.checked = pageNumber === clampedPage;
                input.value = String(pageNumber);
            }
            return label;
        });

        pages.replaceChildren(...pageButtons);

        // Сбрасываем все другие radio buttons со страницами, которые могут быть в форме
        // Это важно, чтобы при следующем collectState() возвращалась правильная страница
        const form = pages.closest('form');
        if (form) {
            const allPageInputs = form.querySelectorAll('input[name="page"]');
            allPageInputs.forEach(input => {
                if (input.value !== String(clampedPage)) {
                    input.checked = false;
                }
            });
        }

        // Важное: `rowsPerPage` — это <select>, он хранится в elements объекта pagination,
        // а не передаётся сюда. Поэтому значение синхронизируется в main.js через state.
    }

    return {
        updatePagination,
        applyPagination
    };
}