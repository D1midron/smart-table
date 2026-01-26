import {makeIndex} from "./lib/utils.js";

const BASE_URL = 'https://webinars.webdev.education-services.ru/sp7-api';

export function initData() {
    // переменные для кеширования данных
    let sellers;
    let customers;
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

        // если прошлый квери не был ранее установлен или поменялись параметры, то запрашиваем данные с сервера
        const response = await fetch(`${BASE_URL}/records?${nextQuery}`);
        if (!response.ok) {
            throw new Error('Не удалось загрузить записи (records)');
        }
        const records = await response.json();

        const items = Array.isArray(records?.items) ? records.items : [];
        const total = Number(records?.total ?? items.length) || 0;

        lastQuery = nextQuery; // сохраняем для следующих запросов
        lastResult = {
            total,
            items: mapRecords(items)
        };

        return lastResult;
    };

    return {
        getIndexes,
        getRecords
    };
}