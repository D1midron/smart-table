import './fonts/ys-display/fonts.css'
import './style.css'

import {initData} from "./data.js";
import {processFormData, cloneTemplate} from "./lib/utils.js";

import {initTable} from "./components/table.js";
import {initPagination} from "./components/pagination.js";
import {initFiltering} from "./components/filtering.js";
import {initSearching} from "./components/searching.js";
import {initSorting} from "./components/sorting.js";


// Работаем только с данными с сервера
const API = initData();

/**
 * Сбор и обработка полей из таблицы
 * @returns {Object}
 */
function collectState() {
    const state = processFormData(new FormData(sampleTable.container));
    
    // Добавляем rowsPerPage из пагинации, так как он находится вне формы таблицы
    if (paginationElements.elements.rowsPerPage) {
        state.rowsPerPage = paginationElements.elements.rowsPerPage.value;
    }
    
    // Добавляем текущую страницу из radio buttons в пагинации
    const selectedPage = paginationElements.container.querySelector('input[name="page"]:checked');
    if (selectedPage) {
        state.page = selectedPage.value;
    }

    // Добавляем значение глобального поиска (поле search находится вне формы таблицы)
    if (searchElements.elements.search) {
        state.search = searchElements.elements.search.value;
    }

    return {
        ...state
    };
}

/**
 * Перерисовка состояния таблицы при любых изменениях
 * @param {HTMLButtonElement?} action
 */
async function render(action) {
    let state = collectState(); // состояние полей из таблицы
    let query = {}; // здесь будут формироваться параметры запроса
    // другие apply*
    query = applySorting(query, state, action); // result заменяем на query
    query = applySearching(query, state, action); // result заменяем на query
    query = applyFiltering(query, state, action); // result заменяем на query
    query = applyPagination(query, state, action); // обновляем query

    const { total, items } = await API.getRecords(query); // запрашиваем данные с собранными параметрами

    updatePagination(total, query); // перерисовываем пагинатор
    sampleTable.render(items);
}

const sampleTable = initTable({
    tableTemplate: 'table',
    rowTemplate: 'row',
    before: ['header'],
    after: []
}, render);

// Инициализация пагинации
const paginationElements = cloneTemplate('pagination');

const {applyPagination, updatePagination} = initPagination(
    paginationElements.elements,
    (pageNumber) => {
        // функция создания кнопки страницы
        const label = document.createElement('label');
        label.className = 'pagination-button';
        label.setAttribute('aria-label', `Goto page ${pageNumber}`);
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'page';
        input.value = pageNumber;
        const span = document.createElement('span');
        span.textContent = pageNumber;
        label.appendChild(input);
        label.appendChild(span);
        return label;
    }
);

// Инициализация фильтрации
const filterElements = cloneTemplate('filter');
const {applyFiltering, updateIndexes} = initFiltering(filterElements.elements);

// Добавляем фильтр к sampleTable
sampleTable.filter = filterElements;

// Инициализация поиска
const searchElements = cloneTemplate('search');
const applySearching = initSearching('search');

// Инициализация сортировки (после создания таблицы, чтобы получить элементы хэдера)
const sortButtons = [
    sampleTable.elements.sortByDate,
    sampleTable.elements.sortByTotal
].filter(Boolean);
const applySorting = initSorting(sortButtons);

const appRoot = document.querySelector('#app');
appRoot.appendChild(searchElements.container);
appRoot.appendChild(sampleTable.container);
appRoot.appendChild(paginationElements.container);

// Добавляем фильтр в таблицу
sampleTable.container.insertBefore(filterElements.container, sampleTable.container.querySelector('.table-content'));

// Обработчик "Reset all filters" — сбрасывает глобальный поиск, фильтры, сортировку и пагинацию
if (searchElements.elements.reset) {
    searchElements.elements.reset.addEventListener('click', (e) => {
        e.preventDefault();

        // 1. Сброс глобального поиска
        if (searchElements.elements.search) {
            searchElements.elements.search.value = '';
        }

        // 2. Сброс фильтров (дата, customer, seller, totalFrom/totalTo)
        Object.values(filterElements.elements).forEach((el) => {
            if (!el) return;
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                if (el.type === 'radio' || el.type === 'checkbox') return;
                el.value = '';
            }
        });

        // 3. Сброс сортировки (оба столбца)
        [sampleTable.elements.sortByDate, sampleTable.elements.sortByTotal]
            .filter(Boolean)
            .forEach((btn) => btn.setAttribute('data-value', 'none'));

        // 4. Сброс пагинации: первая страница, дефолтное число строк (10)
        if (paginationElements.elements.rowsPerPage) {
            paginationElements.elements.rowsPerPage.value = '10';
        }
        const firstPageInput = paginationElements.container.querySelector('input[name="page"][value="1"]');
        if (firstPageInput) {
            firstPageInput.checked = true;
        }

        // Перерисовываем таблицу с "чистым" состоянием
        render(e.target);
    });
}

// Добавляем обработчики для элементов пагинации, так как они находятся вне формы таблицы
if (paginationElements.elements.rowsPerPage) {
    paginationElements.elements.rowsPerPage.addEventListener('change', (e) => {
        render(e.target);
    });
}

// Обработчики для кнопок пагинации (first, prev, next, last)
if (paginationElements.elements.firstPage) {
    paginationElements.elements.firstPage.addEventListener('click', (e) => {
        e.preventDefault();
        render(e.target);
    });
}

if (paginationElements.elements.previousPage) {
    paginationElements.elements.previousPage.addEventListener('click', (e) => {
        e.preventDefault();
        render(e.target);
    });
}

if (paginationElements.elements.nextPage) {
    paginationElements.elements.nextPage.addEventListener('click', (e) => {
        e.preventDefault();
        render(e.target);
    });
}

if (paginationElements.elements.lastPage) {
    paginationElements.elements.lastPage.addEventListener('click', (e) => {
        e.preventDefault();
        render(e.target);
    });
}

// Обработчик для клика по номеру страницы (radio button)
paginationElements.container.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'page' && e.target.type === 'radio') {
        render(e.target);
    }
});

async function init() {
    const indexes = await API.getIndexes();

    updateIndexes(sampleTable.filter.elements, {
        searchBySeller: indexes.sellers
    });
}

init().then(render);

