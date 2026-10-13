// ---------------------------------------------
// Calculator state
// ---------------------------------------------

const expressionElement = document.querySelector("#expr span");
const mainElement = document.getElementById("main");
const padElement = document.getElementById("pad");

let expression = "";
let isDone = false;
let hasError = false;

const OPERATORS = "+−×÷";

// ---------------------------------------------
// Safe expression evaluator (no eval)
// ---------------------------------------------

function evaluate(source) {
    const tokens = source.match(/\d+\.?\d*|\.\d+|[+\-−×÷%]/g) || [];
    let index = 0;

    const peek = () => tokens[index];
    const next = () => tokens[index++];

    function parseFactor() {
        if (peek() === "-") {
            next();
            return -parseFactor();
        }

        const token = next();

        if (token === undefined || Number.isNaN(parseFloat(token))) {
            throw new Error("Invalid expression");
        }

        let value = parseFloat(token);

        while (peek() === "%") {
            next();
            value /= 100;
        }

        return value;
    }

    function parseTerm() {
        let value = parseFactor();

        while (peek() === "×" || peek() === "÷") {
            const operator = next();
            const right = parseFactor();

            if (operator === "÷") {
                if (right === 0) {
                    throw new Error("Division by zero");
                }

                value /= right;
            } else {
                value *= right;
            }
        }

        return value;
    }

    function parseSum() {
        let value = parseTerm();

        while (peek() === "+" || peek() === "−") {
            const operator = next();
            const right = parseTerm();

            value = operator === "+"
                ? value + right
                : value - right;
        }

        return value;
    }

    const value = parseSum();

    if (index < tokens.length) {
        throw new Error("Invalid expression");
    }

    return value;
}

// ---------------------------------------------
// Number and expression formatting
// ---------------------------------------------

function cleanExpression(source) {
    while (
        source &&
        (OPERATORS.includes(source.slice(-1)) || source.slice(-1) === "-")
    ) {
        source = source.slice(0, -1);
    }

    return source;
}

function roundValue(value) {
    return parseFloat(value.toPrecision(12));
}

function formatExpression(source) {
    return source
        .replace(/\d+\.?\d*/g, (number) => {
            const parts = number.split(".");
            const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");

            return number.includes(".")
                ? `${integerPart}.${parts[1] || ""}`
                : integerPart;
        })
        .replace(/-/g, "−");
}

function formatNumber(value) {
    if (
        Math.abs(value) >= 1e15 ||
        (value !== 0 && Math.abs(value) < 1e-9)
    ) {
        return value
            .toExponential(6)
            .replace(/\.?0+e/, "e");
    }

    return formatExpression(String(value));
}

// ---------------------------------------------
// Update calculator display
// ---------------------------------------------

function render(animate = false) {
    mainElement.classList.remove("err");

    if (hasError) {
        mainElement.textContent = "Can't divide by 0";
        mainElement.classList.add("err");
        void mainElement.offsetWidth;
        return;
    }

    expressionElement.textContent = expression
        ? formatExpression(expression) + (isDone ? " =" : "")
        : "";

    let displayValue = "0";

    if (isDone) {
        displayValue = formatExpression(expression);
    } else if (expression) {
        const cleaned = cleanExpression(expression);
        let liveValue = null;

        try {
            if (cleaned && /[+\-−×÷%]/.test(cleaned.replace(/^-/, ""))) {
                liveValue = roundValue(evaluate(cleaned));
            }
        } catch (error) {
            // Keep displaying the current input if it is incomplete.
        }

        displayValue = liveValue !== null && Number.isFinite(liveValue)
            ? formatNumber(liveValue)
            : formatExpression(
                expression.match(/-?[\d.]+%?$/)?.[0] ||
                expression.slice(-1) ||
                "0"
            );
    }

    mainElement.textContent = displayValue;

    const length = displayValue.length;
    let fontSize = "";

    if (length > 14) {
        fontSize = "24px";
    } else if (length > 11) {
        fontSize = "30px";
    } else if (length > 8) {
        fontSize = "38px";
    }

    mainElement.style.fontSize = fontSize;

    if (animate) {
        mainElement.classList.remove("pop");
        void mainElement.offsetWidth;
        mainElement.classList.add("pop");
    }
}

// ---------------------------------------------
// Calculator actions
// ---------------------------------------------

function getLastNumber() {
    return (expression.match(/[\d.]+$/) || [""])[0];
}

const actions = {
    num(value) {
        if (hasError || isDone) {
            expression = "";
            isDone = false;
            hasError = false;
        }

        if (expression.length >= 28) {
            return;
        }

        if (/^0$|[+−×÷-]0$/.test(expression) && value !== ".") {
            expression = expression.slice(0, -1);
        }

        expression += value;
    },

    dot() {
        if (hasError || isDone) {
            expression = "";
            isDone = false;
            hasError = false;
        }

        const lastNumber = getLastNumber();

        if (lastNumber.includes(".")) {
            return;
        }

        if (lastNumber === "" || expression.endsWith("%")) {
            expression += expression.endsWith("%") ? "×0." : "0.";
        } else {
            expression += ".";
        }
    },

    op(value) {
        hasError = false;
        isDone = false;

        if (!expression) {
            if (value === "−") {
                expression = "-";
            }

            return;
        }

        if (expression === "-") {
            return;
        }

        if (OPERATORS.includes(expression.slice(-1))) {
            expression = expression.slice(0, -1) + value;
        } else {
            expression += value;
        }
    },

    pct() {
        if (hasError || !expression) {
            return;
        }

        isDone = false;

        if (/[\d%]$/.test(expression)) {
            expression += "%";
        }
    },

    sign() {
        if (hasError || !expression) {
            return;
        }

        isDone = false;

        const match = expression.match(/(^|[+−×÷])(-?)([\d.]+%?)$/);

        if (!match) {
            return;
        }

        const start = expression.length - match[0].length + match[1].length;

        expression =
            expression.slice(0, start) +
            (match[2] ? "" : "-") +
            match[3];
    },

    back() {
        if (hasError) {
            actions.clear();
            return;
        }

        if (isDone) {
            isDone = false;
            return;
        }

        expression = expression.slice(0, -1);
    },

    clear() {
        expression = "";
        isDone = false;
        hasError = false;
    },

    eq() {
        if (!expression || isDone || hasError) {
            return;
        }

        const cleaned = cleanExpression(expression);

        try {
            const value = roundValue(evaluate(cleaned));

            if (!Number.isFinite(value)) {
                throw new Error("Division by zero");
            }

            const previousExpression = cleaned;

            expression = String(value);
            isDone = true;

            expressionElement.textContent =
                formatExpression(previousExpression) + " =";

            render(true);

            expressionElement.textContent =
                formatExpression(previousExpression) + " =";

            return "ok";
        } catch (error) {
            if (error.message === "Division by zero") {
                hasError = true;
            }
        }
    }
};

function press(action, value) {
    const result = actions[action]?.(value);

    if (result !== "ok") {
        render(action === "eq" && !hasError);
    }
}

// ---------------------------------------------
// Button click handling
// ---------------------------------------------

padElement.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) {
        return;
    }

    press(button.dataset.a, button.dataset.v);
});

// ---------------------------------------------
// Keyboard support
// ---------------------------------------------

const KEY_MAP = {
    "*": "*",
    x: "*",
    X: "*",
    "/": "/",
    "=": "Enter",
    Delete: "Escape",
    c: "Escape",
    C: "Escape"
};

window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }

    const key = KEY_MAP[event.key] || event.key;
    const selectorKey = CSS.escape(key);

    const button = document.querySelector(
        `button[data-k="${selectorKey}"]`
    );

    if (!button) {
        return;
    }

    event.preventDefault();

    button.classList.add("hit");

    setTimeout(() => {
        button.classList.remove("hit");
    }, 110);

    press(button.dataset.a, button.dataset.v);
});

render();
