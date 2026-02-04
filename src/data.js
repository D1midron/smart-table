import {makeIndex} from "./lib/utils.js";
import {sortCollection} from "./lib/sort.js";

const BASE_URL = 'https://webinars.webdev.education-services.ru/sp7-api';

// Все данные (начальные, с фильтрами и пагинацией)
// теперь ВСЕГДА берутся с сервера.
export function initData() {
    // переменные для кеширования данных
    let sellers;
    let customers;
    let lastResult;
    let lastQuery;

    // функция для приведения строк в тот вид, который нужен нашей таблице
    // ВАЖНО: справочники /sellers и /customers в этом API могут приходить:
    // - как массив объектов [{id, first_name, last_name}, ...]
    // - или как объект-словарь {"customer_2": "Petr Smirnov", ...}
    // Поэтому маппинг ищет имя по "ключу" (id) в словаре.
    const mapRecords = (data) => data.map(item => {
        // В records ключ может быть в разных полях/форматах: customer_2, seller_5, 5, ...
        const sellerKey = String(item.seller_id ?? item.seller ?? item.sellerId ?? item.sellerID ?? '');
        const customerKey = String(item.customer_id ?? item.customer ?? item.customerId ?? item.customerID ?? '');

        const sellerName = sellers?.[sellerKey] ?? '';
        const customerName = customers?.[customerKey] ?? '';

        return {
            id: item.receipt_id ?? item.id,
            date: item.date,
            seller: sellerName || sellerKey,       // если имени нет — показываем ключ
            customer: customerName || customerKey, // если имени нет — показываем ключ
            // приводим к числу, чтобы сортировка по total работала корректно
            total: Number(item.total_amount ?? item.total ?? 0)
        };
    });

    // функция получения индексов
    const getIndexes = async () => {
        if (!sellers || !customers) { // если индексы ещё не установлены, то делаем запросы
            // запрашиваем данные с API
            const [sellersRes, customersRes] = await Promise.all([
                fetch(`${BASE_URL}/sellers`),
                fetch(`${BASE_URL}/customers`),
            ]);

            if (!sellersRes.ok || !customersRes.ok) {
                throw new Error('Не удалось загрузить справочники sellers/customers');
            }

            const [sellersRaw, customersRaw] = await Promise.all([
                sellersRes.json(),
                customersRes.json()
            ]);

            const normalizeIndex = (data, fallbackKey) => {
                // вариант 1: сервер сразу вернул словарь id -> name
                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    // иногда API заворачивает словарь в поле (fallbackKey / items)
                    if (data[fallbackKey] && typeof data[fallbackKey] === 'object' && !Array.isArray(data[fallbackKey])) {
                        return data[fallbackKey];
                    }
                    if (data.items && typeof data.items === 'object' && !Array.isArray(data.items)) {
                        return data.items;
                    }
                    // "чистый" словарь
                    return data;
                }

                // вариант 2: сервер вернул массив объектов — строим словарь сами
                const normalizeArray = (arrLike) => {
                    if (Array.isArray(arrLike)) return arrLike;
                    if (arrLike && Array.isArray(arrLike[fallbackKey])) return arrLike[fallbackKey];
                    if (arrLike && Array.isArray(arrLike.items)) return arrLike.items;
                    return [];
                };

                const arr = normalizeArray(data);
                return makeIndex(
                    arr.map(v => ({ ...v, id: String(v.id ?? v[`${fallbackKey}_id`]) })),
                    'id',
                    v => `${v.first_name ?? ''} ${v.last_name ?? ''}`.trim()
                );
            };

            sellers = normalizeIndex(sellersRaw, 'sellers');
            customers = normalizeIndex(customersRaw, 'customers');
        }

        return { sellers, customers };
    };

    // функция получения записей о продажах с сервера
    const getRecords = async (query, isUpdated = false) => {
        const qs = new URLSearchParams(query); // преобразуем объект параметров в SearchParams объект, представляющий query часть url
        const nextQuery = qs.toString(); // и приводим к строковому виду

        if (lastQuery === nextQuery && !isUpdated) { // isUpdated параметр нужен, чтобы иметь возможность делать запрос без кеша
            return lastResult; // если параметры запроса не поменялись, то отдаём сохранённые ранее данные
        }

        // гарантируем, что справочники загружены до маппинга записей
        await getIndexes();

        // запрашиваем данные с сервера (с учётом фильтров и пагинации в query)
        const response = await fetch(`${BASE_URL}/records?${nextQuery}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить записи (records)');
        }
        const records = await response.json();

        const items = Array.isArray(records?.items) ? records.items : [];
        const total = Number(records?.total ?? items.length) || 0;

        lastQuery = nextQuery; // сохраняем для следующих запросов

        // данные всегда приходят с сервера и маппятся к формату таблицы
        // а сортировку (по total/date) и фильтрацию по диапазону total выполняем на клиенте,
        // чтобы не зависеть от реализации бэка
        let finalItems = mapRecords(items);

        // Клиентская фильтрация по totalFrom / totalTo:
        // - totalFrom: значения меньше введенного не показываются (total >= from)
        // - totalTo: значения больше введенного не показываются (total <= to)
        const totalFrom = query.totalFrom != null ? Number(query.totalFrom) : null;
        const totalTo = query.totalTo != null ? Number(query.totalTo) : null;

        if (Number.isFinite(totalFrom)) {
            finalItems = finalItems.filter((item) => Number(item.total) >= totalFrom);
        }
        if (Number.isFinite(totalTo)) {
            finalItems = finalItems.filter((item) => Number(item.total) <= totalTo);
        }

        const sortParam = query.sort;
        if (sortParam) {
            const [sortField, sortOrder] = sortParam.split(':');
            const fieldMap = {
                'total_amount': 'total',
                'date': 'date'
            };
            const mappedField = fieldMap[sortField] || sortField;
            finalItems = sortCollection(finalItems, mappedField, sortOrder);
        }

        lastResult = {
            total,
            items: finalItems
        };

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    };
}