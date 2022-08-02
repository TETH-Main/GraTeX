// https://zenn.dev/mryhryki/articles/2020-11-12-hatena-background-color

const BLACK = {fontColor : '#000000', backgroundColor : '#FFFFFF', composite : 'multiply'}
const WHITE = {fontColor : '#FFFFFF', backgroundColor : '#000000', composite : 'lighter'}

// 人間の視覚特性にあった輝度に変換する
const getRGBForCalculateLuminance = (_color) => {
    const color = _color / 255
    if (color <= 0.03928) {
      return color / 12.92;
    } else {
      return Math.pow(((color + 0.055) / 1.055), 2.4);
    }
}
  
  // 相対輝度に変換する
const getRelativeLuminance = (color) => {
    const {red, green, blue} = color
    const R = getRGBForCalculateLuminance(red);
    const G = getRGBForCalculateLuminance(green);
    const B = getRGBForCalculateLuminance(blue);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

const getContrastRatio = (color1, color2) => {
    const luminance1 = getRelativeLuminance(color1);
    const luminance2 = getRelativeLuminance(color2);
    const bright = Math.max(luminance1, luminance2);
    const dark = Math.min(luminance1, luminance2);
    return (bright + 0.05) / (dark + 0.05);
}

const getFontColor = (color) => {
    const whiteRatio = getContrastRatio(color, {red: 0, green: 0, blue: 0})
    const blackRatio = getContrastRatio(color, {red: 255, green: 255, blue: 255})
    return whiteRatio < blackRatio ? WHITE : BLACK
}

function contrast(color) {
    red = color.slice(1, 3);
    green = color.slice(3, 5);
    blue = color.slice(5, 7);
    const backgroundColor = {red: parseInt(red, 16), green: parseInt(green, 16), blue: parseInt(blue, 16)};
    return getFontColor(backgroundColor);
}
