import ClientFactory from '../client';
import OfflineProducerFactory from '../producer/offline';
import callbackHandler from '../readiness/callbacksHandler';

//
// Create SDK instance for offline mode.
//
function SplitFactoryOffline(context, gateFactory, sharedTrackers) {
  const sharedInstance = !sharedTrackers;
  const settings = context.get(context.constants.SETTINGS);
  const storage = context.get(context.constants.STORAGE);

  // Put readiness config within context
  const readiness = gateFactory(settings.startup.readyTimeout);
  context.put(context.constants.READINESS, readiness);

  // We are only interested in exposable EventEmitter
  const { gate } = readiness;

  // Events name
  const {
    SDK_READY,
    SDK_UPDATE,
    SDK_READY_TIMED_OUT
  } = gate;

  // Ready promise
  const readyFlag = callbackHandler(gate)(sharedInstance);

  // Producer
  const producer = sharedInstance ? undefined : OfflineProducerFactory(context);

  // Start background task for flag updates
  producer && producer.start();

  const api = Object.assign(
    // Proto linkage of the EventEmitter to prevent any change
    Object.create(gate),
    // GetTreatment/s
    ClientFactory(context),
    // Utilities
    {
      // Ready promise
      ready() {
        return readyFlag;
      },

      // Events contants
      Event: {
        SDK_READY,
        SDK_UPDATE,
        SDK_READY_TIMED_OUT
      },

      // Destroy instance. Async so we respect the online api.
      async destroy() {
        // Stop background jobs
        producer && producer.stop();
        // Cleanup event listeners
        readiness.destroy();
        // Cleanup storage
        storage.destroy && storage.destroy();
        // Mark the factory as destroyed.
        context.put(context.constants.DESTROYED, true);
      }
    }
  );

  return {
    api,
    metricCollectors: false // We won't collect any metrics on localhost mode.
  };
}

export default SplitFactoryOffline;
