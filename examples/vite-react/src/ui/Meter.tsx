import { fill, meter } from "./Meter.styles.js";

export function Meter({ value, max }: { value: number; max: number }) {
  return (
    <div>
      <div className={meter.track}>
        <div className={meter.fill} style={fill(value / max)} />
      </div>
      <p className={meter.label}>
        {value} of {max}
      </p>
    </div>
  );
}
