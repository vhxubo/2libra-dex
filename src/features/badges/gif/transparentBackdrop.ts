/** 透明背景的棋盘格底纹：预览时示意透明区域不会被铺底色。 */
export const TRANSPARENT_BACKDROP_STYLE: React.CSSProperties = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'linear-gradient(45deg, #d4d4d8 25%, transparent 25%, transparent 75%, #d4d4d8 75%), linear-gradient(45deg, #d4d4d8 25%, transparent 25%, transparent 75%, #d4d4d8 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 6px 6px',
}
