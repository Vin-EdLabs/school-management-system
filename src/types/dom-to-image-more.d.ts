declare module 'dom-to-image-more' {
  type DomToImageOptions = {
    width?: number;
    height?: number;
    quality?: number;
    bgcolor?: string;
    style?: Record<string, string>;
  };

  const domtoimage: {
    toPng(node: Node, options?: DomToImageOptions): Promise<string>;
    toJpeg(node: Node, options?: DomToImageOptions): Promise<string>;
    toBlob(node: Node, options?: DomToImageOptions): Promise<Blob>;
  };

  export default domtoimage;
}
