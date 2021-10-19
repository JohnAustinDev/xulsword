export default function eventHandler(e) {
  switch (e.type) {
    case 'click':
      break;

    case 'keyUp':
      break;

    default:
      throw Error(`Unhandled event type ${e.type}`);
  }
}
