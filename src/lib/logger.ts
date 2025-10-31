import { createConsola, LogLevels } from "consola";
import { IS_DEV, APP_NAME } from "./const";

const logger = createConsola({
  level: IS_DEV ? LogLevels.debug : LogLevels.info,
  defaults: {
    tag: APP_NAME,
  },
});

export default logger;
