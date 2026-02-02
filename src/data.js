import {makeIndex} from "./lib/utils.js";
import {sortCollection} from "./lib/sort.js";

const BASE_URL = 'https://webinars.webdev.education-services.ru/sp7-api';

export function initData(sourceData = null) {
    // переменные для кеширования данных
    let sellers;
    let customers;
    let sellersByName; // обратный индекс: имя -> id
    let customersByName; // обратный индекс: имя -> id
    let lastResult;
    let lastQuery;

    // функция для приведения строк в тот вид, который нужен нашей таблице
    const mapRecords = (data) => data.map(item => ({
        id: item.receipt_id,
        date: item.date,
        seller: sellers?.[String(item.seller_id)] ?? String(item.seller_id ?? ''),
        customer: customers?.[String(item.customer_id)] ?? String(item.customer_id ?? ''),
        total: item.total_amount
    }));

    // функция получения индексов
    const getIndexes = async () => {
        if (!sellers || !customers) { // если индексы ещё не установлены, то делаем запросы
            let sellersRaw, customersRaw;

            if (sourceData) {
                //  запрашиваем данные с API
                const [sellersRes, customersRes] = await Promise.all([
                    fetch(`${BASE_URL}/sellers`),
                    fetch(`${BASE_URL}/customers`),
                ]);

                if (!sellersRes.ok || !customersRes.ok) {
                    throw new Error('Не удалось загрузить справочники sellers/customers');
                }

                [sellersRaw, customersRaw] = await Promise.all([
                    sellersRes.json(),
                    customersRes.json()
                ]);
               
            } else {
                // используем локальные данные
                sellersRaw = sourceData.sellers || [];
                customersRaw = sourceData.customers || [];
                
                
            }

            const normalizeArray = (data, fallbackKey) => {
                if (Array.isArray(data)) return data;
                if (data && Array.isArray(data[fallbackKey])) return data[fallbackKey];
                if (data && Array.isArray(data.items)) return data.items;
                return [];
            };

            const sellersData = normalizeArray(sellersRaw, 'sellers');
            const customersData = normalizeArray(customersRaw, 'customers');

            // преобразуем массивы в индексы для быстрого доступа по id
            sellers = makeIndex(
                sellersData.map(v => ({ ...v, id: String(v.id) })),
                'id',
                v => `${v.first_name} ${v.last_name}`
            );
            customers = makeIndex(
                customersData.map(v => ({ ...v, id: String(v.id) })),
                'id',
                v => `${v.first_name} ${v.last_name}`
            );

            // создаем обратные индексы для поиска по имени
            sellersByName = {};
            customersByName = {};
            sellersData.forEach(v => {
                const name = `${v.first_name} ${v.last_name}`;
                sellersByName[name] = String(v.id);
            });
            customersData.forEach(v => {
                const name = `${v.first_name} ${v.last_name}`;
                customersByName[name] = String(v.id);
            });
        }

        return { sellers, customers };
    }

    // функция получения записей о продажах с сервера
    const getRecords = async (query, isUpdated = false) => {
        const qs = new URLSearchParams(query); // преобразуем объект параметров в SearchParams объект, представляющий query часть url
        const nextQuery = qs.toString(); // и приводим к строковому виду

        if (lastQuery === nextQuery && !isUpdated) { // isUpdated параметр нужен, чтобы иметь возможность делать запрос без кеша
            return lastResult; // если параметры запроса не поменялись, то отдаём сохранённые ранее данные
        }

        // гарантируем, что справочники загружены до маппинга записей
        await getIndexes();

        let records;

        if (sourceData) {
            // используем локальные данные
            let items = sourceData.purchase_records || [];

            // Применяем фильтры
            const filterSeller = query['filter[seller]'];
            const filterCustomer = query['filter[customer]'];
            const filterDate = query['filter[date]'];
            const filterTotalFrom = query['filter[totalFrom]'];
            const filterTotalTo = query['filter[totalTo]'];
            const searchQuery = query.search;

            // Фильтрация по продавцу (по имени, нужно найти ID)
            if (filterSeller && sellersByName) {
                const sellerId = sellersByName[filterSeller];
                if (sellerId) {
                    items = items.filter(item => String(item.seller_id) === sellerId);
                } else {
                    items = []; // если имя не найдено, возвращаем пустой массив
                }
            }

            // Фильтрация по покупателю (по имени, нужно найти ID)
            if (filterCustomer && customersByName) {
                const customerId = customersByName[filterCustomer];
                if (customerId) {
                    items = items.filter(item => String(item.customer_id) === customerId);
                } else {
                    items = []; // если имя не найдено, возвращаем пустой массив
                }
            }

            // Фильтрация по дате
            if (filterDate) {
                items = items.filter(item => item.date && item.date.includes(filterDate));
            }

            // Фильтрация по диапазону суммы
            if (filterTotalFrom) {
                const from = Number(filterTotalFrom);
                if (!isNaN(from)) {
                    items = items.filter(item => item.total_amount >= from);
                }
            }
            if (filterTotalTo) {
                const to = Number(filterTotalTo);
                if (!isNaN(to)) {
                    items = items.filter(item => item.total_amount <= to);
                }
            }

            // Поиск (глобальный поиск по всем полям)
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                items = items.filter(item => {
                    const sellerName = sellers?.[String(item.seller_id)] ?? '';
                    const customerName = customers?.[String(item.customer_id)] ?? '';
                    return (
                        (item.date && item.date.toLowerCase().includes(searchLower)) ||
                        (sellerName && sellerName.toLowerCase().includes(searchLower)) ||
                        (customerName && customerName.toLowerCase().includes(searchLower)) ||
                        (item.total_amount && String(item.total_amount).includes(searchLower))
                    );
                });
            }

            // Сначала маппим данные для сортировки
            let mappedItems = mapRecords(items);

            // Применяем сортировку
            const sortParam = query.sort;
            if (sortParam) {
                const [sortField, sortOrder] = sortParam.split(':');
                const fieldMap = {
                    'total_amount': 'total',
                    'date': 'date'
                };
                const mappedField = fieldMap[sortField] || sortField;
                mappedItems = sortCollection(mappedItems, mappedField, sortOrder);
            }

            // Применяем пагинацию
            const limit = Number(query.limit) || 10;
            const page = Number(query.page) || 1;
            const start = (page - 1) * limit;
            const end = start + limit;
            const paginatedItems = mappedItems.slice(start, end);

            records = {
                items: paginatedItems, // уже замаппленные данные
                total: mappedItems.length
            };
        } else {
            // запрашиваем данные с сервера
            const response = await fetch(`${BASE_URL}/records?${nextQuery}`);
            if (!response.ok) {
                throw new Error('Не удалось загрузить записи (records)');
            }
            records = await response.json();
        }

        const items = Array.isArray(records?.items) ? records.items : [];
        const total = Number(records?.total ?? items.length) || 0;

        lastQuery = nextQuery; // сохраняем для следующих запросов
        
        // Если данные уже замаплены (локальные данные), возвращаем как есть
        // Иначе маппим данные
        const finalItems = sourceData ? items : mapRecords(items);
        
        lastResult = {
            total,
            items: finalItems
        };

        return lastResult;

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    };
}