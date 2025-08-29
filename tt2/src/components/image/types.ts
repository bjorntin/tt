export type ImageViewProps = {
  uri: string;
  itemSize: number;
  onPress?: () => void;
  onLongPress?: () => void;
  originalUri?: string; // URI to use for PII status checking (falls back to uri if not provided)
};
