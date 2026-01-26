import './fonts/ys-display/fonts.css'
import './style.css'

import {data as sourceData} from "./data/dataset_1.js";

import {initData} from "./data.js";
import {processFormData, cloneTemplate} from "./lib/utils.js";

import {initTable} from "./components/table.js";
import {initPagination} from "./components/pagination.js";
import {initFiltering} from "./components/filtering.js";
import {initSearching} from "./components/searching.js";
import {initSorting} from "./components/sorting.js";


// Исходные данные используемые в render()
const API = initData(sourceData);

/**
 * Сбор и обработка полей из таблицы
 * @returns {Object}
 */
function collectState() {
    const state = processFormData(new FormData(sampleTable.container));

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
    before: [],
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

// Инициализация сортировки
const applySorting = initSorting([]);

const appRoot = document.querySelector('#app');
appRoot.appendChild(searchElements.container);
appRoot.appendChild(sampleTable.container);
appRoot.appendChild(paginationElements.container);

// Добавляем фильтр в таблицу
sampleTable.container.insertBefore(filterElements.container, sampleTable.container.querySelector('.table-content'));

async function init() {
    const indexes = await API.getIndexes();

    updateIndexes(sampleTable.filter.elements, {
        searchBySeller: indexes.sellers
    });
}

init().then(render);

