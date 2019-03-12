# UAL Scatter Authenticator

This authenticator is meant to be used with [Scatter](https://get-scatter.com/) and [Universal Authenticator Library](https://github.com/EOSIO/universal-authenticator-library). When used in combination with them, it gives developers the ability to request transaction signatures through Scatter using the common UAL API.

## Supported Environments
- The Scatter Authenticator only supports Desktop Browser Environments

## Getting Started

`yarn add @blockone/ual-scatter`

#### Dependencies

You must use one of the UAL renderers below.

React - `@blockone/universal-authenticator-library-reactjs-renderer`


Vanillajs - `@blockone/universal-authenticator-library-plain-js-renderer`


#### Basic Usage with React

```javascript
import { Scatter } from '@blockone/ual-scatter'
import { UALProvider, withUAL } from '@blockone/universal-authenticator-library-reactjs-renderer'

const exampleNet = {
  chainId: '',
  rpcEndpoints: [{
    protocol: '',
    host: '',
    port: '',
  }]
}

const App = (props) => <div>{JSON.stringify(props.ual)}</div>
const AppWithUAL = withUAL(App)

const scatter = new Scatter([exampleNet], { appName: 'Example App' })

<UALProvider chains={[exampleNet]} authenticators={[scatter]}>
  <AppWithUAL />
</UALProvider>
```

## Contributing

[Contributing Guide](https://github.com/EOSIO/ual-scatter/blob/develop/CONTRIBUTING.md)

[Code of Conduct](https://github.com/EOSIO/ual-scatter/blob/develop/CONTRIBUTING.md#conduct)

## License

[MIT](https://github.com/EOSIO/ual-scatter/blob/develop/LICENSE)
