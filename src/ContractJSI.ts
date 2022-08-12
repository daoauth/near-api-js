import { Definitions, JSI, Properties, JsonSchemaInterface } from '@dsrv/jsi';
import BN from 'bn.js';
import { Account } from './account';

interface Option {
    gas?: BN;
    amount?: BN;
    meta?: string;
    callbackUrl?: string;
}

/**
 * Defines a smart contract on NEAR including the change (mutable) and view (non-mutable) methods
 * 
 * @example
 * ```js
 * import { ContractJSI } from 'near-api-js';
 * 
 * const ChangeMethods = {
 *   $schema: "http://json-schema.org/draft-07/schema#",
 *   title: "ChangeMethods",
 *   anyOf: [{
 *       type: "object",
 *       required: ["create_poll"],
 *       properties: {
 *          create_poll: {
 *           type: "object",
 *           required: ["description"],
 *           properties: {
 *             description: {
 *               type: "string",
 *             },
 *             end_height: {
 *               type: ["integer", "null"],
 *               format: "uint64",
 *               minimum: 0.0,
 *             },
 *             quorum_percentage: {
 *               type: ["integer", "null"],
 *               format: "uint8",
 *               minimum: 0.0,
 *             },
 *             start_height: {
 *               type: ["integer", "null"],
 *               format: "uint64",
 *               minimum: 0.0,
 *             },
 *           },
 *         },
 *       },
 *       additionalProperties: false,
 *     }
 *   ]
 * }
 * 
 * const ViewMethods = {
 *   $schema: "http://json-schema.org/draft-07/schema#",
 *   title: "ViewMethods",
 *   anyOf: [{
 *      type: "object",
 *      required: ["token_stake"],
 *      properties: {
 *        token_stake: {
 *          type: "object",
 *          required: ["address"],
 *          properties: {
 *            address: {
 *              type: "string",
 *            },
 *          },
 *        },
 *      },
 *      additionalProperties: false,
 *    },
 *   ]
 * }
 * 
 * async function contractExample() {
 *   const methodOptions = {
 *     ChangeMethods,
 *     ViewMethods,
 *   };
 * 
 *   const contract = ContractJSI(
 *     wallet.account(),
 *     'contract-id.testnet',
 *     methodOptions
 *   );
 * 
 *   // use a contract view method
 *   const messages = await contract.ViewMethods.token_stake("example-account.testnet");
 * 
 *   // use a contract change method
 *   await contract.ChangeMethods.create_poll({
 *      meta: 'some info',
 *      callbackUrl: 'https://example.com/callback',
 *      args: { text: 'my message' },
 *      amount: 1
 *   }, "description");
 * }
 * ```
 */

export function ContractJSI(account: Account, contractId: string, contractMethods: {
    ChangeMethods?: JsonSchemaInterface;
    ViewMethods?: JsonSchemaInterface;
}) {
    function CreateArgs(params: any[], properties: Properties) {
        const args = {};
        params.forEach((value: any, index: number) => {
            const keys = Object.keys(properties);
            args[keys[index]] = value;
        });
        return args;
    }

    function BuildChangeMethod(methodName: string, required: string[], properties: Properties, definitions: Definitions) {
        return async function ({ gas, amount, meta, callbackUrl }: Option, ...params: any[]) {
            JSI.verifyParameters(required, properties, definitions, params);
            const args = CreateArgs(params, properties);
            const rawResult = await account.functionCall({
                contractId,
                methodName,
                args,
                gas,
                attachedDeposit: amount,
                walletMeta: meta,
                walletCallbackUrl: callbackUrl
            });
            return rawResult;
        };
    }
    
    function BuildViewMethod(methodName: string, required: string[], properties: Properties, definitions: Definitions) {
        return async function (...params: any[]) {
            JSI.verifyParameters(required, properties, definitions, params);
            const args = CreateArgs(params, properties);
            return account.viewFunction(contractId, methodName, args);
        };
    }

    const { ChangeMethods, ViewMethods } = contractMethods;
    const methods = {};

    if (ChangeMethods) {
        methods['ChangeMethods'] = { schema: ChangeMethods, buildMethod: BuildChangeMethod };
    }

    if (ViewMethods) {
        methods['ViewMethods'] = { schema: ViewMethods, buildMethod: BuildViewMethod };
    }
    
    const contract = new JSI(methods);
    return contract;
}
