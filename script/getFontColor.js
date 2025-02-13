// https://zenn.dev/mryhryki/articles/2020-11-12-hatena-background-color

class ColorUtils {
    static getRGBForCalculateLuminance(_color) {
        const color = _color / 255;
        if (color <= 0.03928) {
            return color / 12.92;
        } else {
            return Math.pow((color + 0.055) / 1.055, 2.4);
        }
    }

    static getRelativeLuminance(color) {
        const { red, green, blue } = color;
        const R = this.getRGBForCalculateLuminance(red);
        const G = this.getRGBForCalculateLuminance(green);
        const B = this.getRGBForCalculateLuminance(blue);
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    }

    static getContrastRatio(color1, color2) {
        const luminance1 = this.getRelativeLuminance(color1);
        const luminance2 = this.getRelativeLuminance(color2);
        const bright = Math.max(luminance1, luminance2);
        const dark = Math.min(luminance1, luminance2);
        return (bright + 0.05) / (dark + 0.05);
    }

    static getFontColor(color) {
        const whiteRatio = this.getContrastRatio(color, { red: 0, green: 0, blue: 0 });
        const blackRatio = this.getContrastRatio(color, { red: 255, green: 255, blue: 255 });
        return whiteRatio < blackRatio ? 'white' : 'black';
    }

    static contrast(color) {
        const red = color.slice(1, 3);
        const green = color.slice(3, 5);
        const blue = color.slice(5, 7);
        const backgroundColor = { red: parseInt(red, 16), green: parseInt(green, 16), blue: parseInt(blue, 16) };
        return this.getFontColor(backgroundColor);
    }
}
