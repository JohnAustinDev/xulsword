import G from '../gr';

export default function viewportHandler(e, ...args) {
  const ctClass = e.currentTarget.classList;
  switch (e.type) {
    case 'click': {
      e.stopPropagation();
      if (ctClass.contains('open-chooser')) {
        this.setState({ showChooser: true });
      } else if (ctClass.contains('close-chooser')) {
        this.setState({ showChooser: false });
      } else {
        throw Error(
          `Unhandled viewportHandler onClick event on '${e.currentTarget.className}'`
        );
      }
      break;
    }

    default:
      throw Error(`Unhandled viewportHandler event type '${e.type}'`);
  }
}
