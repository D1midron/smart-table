import {sortMap} from "../lib/sort.js";

export function initSorting(columns) {
    return (query, state, action) => {
        let field = null;
        let order = null;

        if (action && action.name === 'sort') {
            const current = action.getAttribute('data-value') || 'none';
            const next = sortMap[current] || 'none';

            action.setAttribute('data-value', next);
            field = action.getAttribute('data-field');
            order = next;

            columns
                .filter((btn) => btn && btn !== action)
                .forEach((btn) => btn.setAttribute('data-value', 'none'));
        } else {
            const active = columns.find((btn) => btn && (btn.getAttribute('data-value') || 'none') !== 'none');
            if (active) {
                field = active.getAttribute('data-field');
                order = active.getAttribute('data-value') || 'none';
            }
        }

        const fieldMap = {
            total: 'total_amount'
        };

        const apiField = field ? (fieldMap[field] ?? field) : null;

        return (apiField && order !== 'none')
            ? Object.assign({}, query, { sort: `${apiField}:${order}` })
            : query;
    }
}