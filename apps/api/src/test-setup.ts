import { Logger } from '@nestjs/common';

// Keep test output readable: error-path tests intentionally trigger service logging.
Logger.overrideLogger(false);
