const hexReg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/;

const isUndefined = x => {
    return x === undefined;
};

const isDefined = x => {
    return !isUndefined(x);
};

const fit = (n, end, start) => {
    if(isUndefined(start)) start = 0;
    if(isUndefined(end)) end = 255;
    return Math.min(Math.max(n, start), end);
}

const clamp = (v, max) => {
    return fit(v, max);
};

const number = n => {
    if(typeof(n) == 'number') return n;
    return parseFloat(n);
}

const clampNumber = (x, max) => {
    return clamp(number(x), max);
};

const convertToRgbInt = x => {
    return parseInt(clampNumber(x, 255));
};

const hexToRgb = hex => {
    if(hex && hexReg.test(hex)) {
        hex = hex.toLowerCase();
        if(hex.length === 4) {
            let hexNew = '#';
            for(let i = 1; i < 4; i++) {
                hexNew += hex.slice(i, i + 1).concat(hex.slice(i, i + 1));
            }
            hex = hexNew;
        }

        let hexChange = [];
        for(let i = 1; i < 7; i += 2) {
            hexChange.push(parseInt('0x' + hex.slice(i, i + 2)));
        }
        return {
            r: hexChange[0],
            g: hexChange[1],
            b: hexChange[2],
            a: 1
        };
    } else {
        throw new Error('Wrong hex string! (hex: ' + hex + ')');
    }
};

const isColor = hex => {
    return typeof(hex) === 'string' && (hex.toLowerCase() === 'transparent' || hexReg.test(hex.trim().toLowerCase()));
}

const hslToRgb = hsl => {
    const hue = h => {
        h = h < 0 ? h + 1 : (h > 1 ? h - 1 : h);
        if(h * 6 < 1) {
            return m1 + (m2 - m1) * h * 6;
        } else if(h * 2 < 1) {
            return m2;
        } else if(h * 3 < 2) {
            return m1 + (m2 - m1) * (2 / 3 - h) * 6;
        } else {
            return m1;
        }
    };

    let h = hsl.h,
        s = hsl.s,
        l = hsl.l,
        a = hsl.a;

    h = (number(h) % 360) / 360;
    s = clampNumber(s);
    l = clampNumber(l);
    a = clampNumber(a);

    var m2 = l <= 0.5 ? l * (s + 1) : l + s - l * s;
    var m1 = l * 2 - m2;

    var r = {
        r: hue(h + 1 / 3) * 255,
        g: hue(h) * 255,
        b: hue(h - 1 / 3) * 255,
        a: a
    };

    return r;
};

const toHexValue = x => {
    x = x.toString(16);
    return x.length == 1 ? ('0' + x) : x;
};

class Color {

    static isColor = isColor;
    static hexToRgb = hexToRgb;
    static hslToRgb = hslToRgb;

    /**
     * Creates an instance of Color.
     *
     * @param {sting|object|number} r
     * @param {any} g
     * @param {any} b
     * @param {number} [a=1]
     * @memberof Color
     */
    constructor(r, g, b, a) {
        this.init(r, g, b, a);
    }

    init(r, g, b, a = 1) {
        this.r = 0;
        this.g = 0;
        this.b = 0;
        this.A = a;

        const paramType = typeof r;
        if(paramType === 'string') {
            const hex = r.toLowerCase();
            if(hex === 'transparent') {
                this.A = 0;
            } else {
                this.rgb = hexToRgb(hex);
            }
        } else if(paramType === 'number') {
            this.R = r;
            this.G = g;
            this.B = b;
        } else if(paramType === 'object') {
            const obj = r;
            if(isDefined(obj.h)) {
                let hsl = {
                    h: clampNumber(obj.h, 360),
                    s: 1,
                    l: 1,
                    a: this.A
                };
                if(isDefined(obj.s)) hsl.s = clampNumber(obj.s, 1);
                if(isDefined(obj.l)) hsl.l = clampNumber(obj.l, 1);
                if(isDefined(obj.a)) hsl.a = clampNumber(obj.a, 1);
                this.rgb = hslToRgb(hsl);
            } else {
                this.rgb = obj;
            }
        }
    }

    get R() {
        return this.r;
    }

    set R(r) {
        this.r = convertToRgbInt(r);
    }

    get G() {
        return this.g;
    }

    set G(g) {
        this.g = convertToRgbInt(g);
    }

    get B() {
        return this.b;
    }

    set B(b) {
        this.b = convertToRgbInt(b);
    }

    get A() {
        return this.a;
    }

    set A(a) {
        this.a = clampNumber(a, 1);
    }

    get rbg() {
        return {
            r: this.r,
            g: this.g,
            b: this.b,
            a: this.a
        };
    }

    set rgb(rgb) {
        if(isDefined(rgb.r)) this.R = rgb.r;
        if(isDefined(rgb.g)) this.G = rgb.g;
        if(isDefined(rgb.b)) this.B = rgb.b;
        if(isDefined(rgb.a)) this.A = rgb.a;
    }

    setRgb(rgb) {
        this.rbg = rbg;
        return this;
    }

    get hsl() {
        let r = this.r / 255,
            g = this.g / 255,
            b = this.b / 255,
            a = this.a;

        let max = Math.max(r, g, b),
            min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2,
            d = max - min;

        if(max === min) {
            h = s = 0;
        } else {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch(max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                case b:
                    h = (r - g) / d + 4;
                    break;
            }
            h /= 6;
        }
        return {
            h: h * 360,
            s: s,
            l: l,
            a: a
        };
    }

    set hsl(hsl) {
        this.rgb = hslToRgb(hsl);
    }

    setHsl(hsl) {
        this.hsl = Object.assign(this.hsl, hsl);
        return this;
    }

    get H() {
        return this.hsl.h;
    }

    set H(hue) {
        let hsl = this.hsl;
        hsl.h = clampNumber(hue, 360);
        this.hsl = hsl;
    }

    get S() {
        return this.hsl.s;
    }

    set S(s) {
        let hsl = this.hsl;
        hsl.s = clampNumber(s, 1);
        this.hsl = hsl;
    }

    get L() {
        return this.hsl.l;
    }

    set L(l) {
        let hsl = this.hsl;
        hsl.l = clampNumber(l, 1);
        this.hsl = hsl;
    }

    get luma() {
        let r = this.r / 255,
            g = this.g / 255,
            b = this.b / 255;

        r = (r <= 0.03928) ? r / 12.92 : Math.pow(((r + 0.055) / 1.055), 2.4);
        g = (g <= 0.03928) ? g / 12.92 : Math.pow(((g + 0.055) / 1.055), 2.4);
        b = (b <= 0.03928) ? b / 12.92 : Math.pow(((b + 0.055) / 1.055), 2.4);

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    get hex() {
        return '#' + toHexValue(this.r) + toHexValue(this.g) + toHexValue(this.b);
    }

    get css() {
        if(this.a > 0) {
            if(this.a < 1) {
                return 'rgba(' + this.r + ',' + this.g + ',' + this.b + ',' + this.a + ')';
            } else {
                return this.hex;
            }
        } else {
            return 'transparent';
        }
    }

    darken(amount) {
        let hsl = this.hsl();

        hsl.l -= amount / 100;
        hsl.l = clamp(hsl.l, 1);

        this.hsl = hsl;
        return this;
    }

    lighten(amount) {
        return this.darken(-amount);
    }

    fade(amount) {
        this.A = clamp(amount/100, 1);
    }

    spin(amount) {
        let hsl = this.hsl;
        let hue = (hsl.h + amount) % 360;

        hsl.h = hue < 0 ? 360 + hue : hue;
        this.hsl = hsl;
        return this;
    }

    saturate(amount) {
        let hsl = this.hsl;

        hsl.s += amount / 100;
        hsl.s = clamp(hsl.s);

        this.hsl = hsl;
        return this;
    }

    lightness(amount) {
        let hsl = this.hsl;

        hsl.l += amount / 100;
        hsl.l = clamp(hsl.l);

        this.hsl = hsl;
        return this;
    }

    contrast(dark, light, threshold = 0.43) {
        if(isUndefined(light)) {
            light = new Color(255, 255, 255, 1);
        } else {
            light = new Color(light);
        }
        if(isUndefined(dark)) {
            dark = new Color(0, 0, 0, 1);
        } else {
            dark = new Color(dark);
        }

        if(dark.luma > light.luma) {
            let swapTmp = light;
            light = dark;
            dark = swapTmp;
        }

        if(this.a < 0.5) {
            return dark;
        } else {
            threshold = number(threshold);
        }

        if(this.isDark(threshold)) {
            return light;
        } else {
            return dark;
        }
    }

    isDark(threshold = 0.43) {
        return this.luma < threshold;
    }

    clone() {
        return new Color(this.r, this.g, this.b, this.a);
    }

    static create(r, g, b, a) {
        if(r instanceof Color) {
            return r;
        }
        return new Color(r, g, b, a);
    }
}

export default Color;

