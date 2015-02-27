/* -*- coding: utf-8 -*-
============================================================================= */
/*jshint asi: true*/

var debug = require('debug')('dnsjs:resolver')

var _ = require("lodash")
var util = require('util')
var async = require('async')
var punycode = require('punycode')
var extend = require('compose-extend')
var dns = require('dns')

/*jshint -W079 */
var Promise = require('bluebird')
/*jshint +W079 */

var consts = require('native-dns-packet').consts;
var utils = require('./utils.js')

/* Resolver
============================================================================= */

var Resolver = function(opts) {
    var self = this
    
    opts = opts || {}
    
    this.opts = opts
    this.debug = opts.debug || debug
    
    this.defaultClass = opts.defaultClass || consts.NAME_TO_QCLASS.IN
    
    this.consts = consts;
    this.utils = utils;
    
    this.BADNAME = consts.BADNAME;
    this.BADRESP = consts.BADRESP;
    this.CONNREFUSED = consts.CONNREFUSED;
    this.DESTRUCTION = consts.DESTRUCTION;
    this.REFUSED = consts.REFUSED;
    this.FORMERR = consts.FORMERR;
    this.NODATA = consts.NODATA;
    this.NOMEM = consts.NOMEM;
    this.NOTFOUND = consts.NOTFOUND;
    this.NOTIMP = consts.NOTIMP;
    this.SERVFAIL = consts.SERVFAIL;
    this.TIMEOUT = consts.TIMEOUT;
    
    this.ADDRCONFIG = dns.ADDRCONFIG
    this.V4MAPPED = dns.V4MAPPED

    this.init.apply(this, arguments)
}
Resolver.extend = extend

Resolver.prototype.init = function(opts) {
    // Nothing to do here    
}

Resolver.prototype.answer = function(callback) {
    function fn(err, res) {
        res = res || {}
        res.header = res.header || {
            rcode: consts.NAME_TO_RCODE.NOERROR
        }
        res.answer = res.answer || []
        res.authority = res.authority || []
        res.additional = res.additional || []
        if (res.answer.length === 0) {
            if (!err) {
                err = new Error('Not found')
            }
            err.code = err.code || consts.NOTFOUND
            res.header.rcode = res.header.rcode || consts.NAME_TO_RCODE.NOTFOUND
        }
        return callback(err, res)
    }
    return fn
}

Resolver.prototype.errback = function(callback) {
    var self = this
    function fn(code, rcode, message) {
        var error
        if (message instanceof Error) {
            error = message
        } else {
            error = new Error(message)
        }
        error.code = code
        return self.answer(callback)(error, {
            header: {
                rcode: rcode
            }
        })
    }
    return fn
}

Resolver.prototype._normalizeRequestType = function(rrtype, callback) {
    var self = this
    var invalidRequestType = function(rrtype) {
        var msg = 'Invalid request type: "' + rrtype + '" (' + typeof rrtype + ')'
        self.debug(msg)
        return self.errback(callback)(consts.FORMERR, consts.NAME_TO_RCODE.FORMERR, msg)
    };
    rrtype = rrtype || 'A';
    var type = rrtype
    if (typeof type === 'string') {
        type = type.toUpperCase()
        if (consts.NAME_TO_QTYPE.hasOwnProperty(type)) {
            type = consts.NAME_TO_QTYPE[rrtype]
        } else {
            return invalidRequestType(rrtype)
        }
    }
    if (typeof type === 'number') {
        if (consts.QTYPE_TO_NAME.hasOwnProperty(type)) {
            return callback(null, type)
        } else {
            return invalidRequestType(rrtype)
        }
    }
    return invalidRequestType(rrtype)
}

/** request
 */
Resolver.prototype.request = function(question, callback) {
    var self = this
    try {
        self.debug('Question: %s', util.inspect(question))
        return self._normalizeRequestType(question.type, function(err, type) {
            if (err) { return callback(err, type) }
            var fname = 'request' + consts.QTYPE_TO_NAME[type]
            self.debug('Searching for "%s"...', fname)
            if (typeof self[fname] === 'function') {
                try {
                    return self[fname].call(self, question, function(err, res) {
                        if (err) {
                            return self.errback(callback)(consts.NOTFOUND, consts.NAME_TO_RCODE.NOTFOUND, err) 
                        }
                        return callback(err, res)
                    })
                } catch(exc) {
                    console.log(exc.stack)
                    return self.errback(callback)(consts.SERVFAIL, consts.NAME_TO_RCODE.SERVFAIL, err)
                }
            }
            return self.errback(callback)(consts.NOTIMP, consts.NAME_TO_RCODE.NOTIMP, 'Unknown type "' + type + '"')
        })
    } catch(exc) {
        console.log('***', exc.stack)
        return self.errback(callback)(consts.SERVFAIL, consts.NAME_TO_RCODE.SERVFAIL, exc)
    }
}
Resolver.prototype.requestAsync = Promise.promisify(Resolver.prototype.request)

var _dataConverters = {
    'A': function(item) {
        return item.address
    },
    'AAAA': function(item) {
        return item.address
    },
    'CNAME': function(item) {
        return item.data
    },
    'NS': function(item) {
        return item.data
    },
    'TXT': function(item) {
        return [item.data]
    },
    'MX': function(item) {
        return {
            priority: item.priority,
            exchange: item.exchange
        }
    },
    'SRV': function(item) {
        return {
            priority: item.priority,
            weight: item.weight,
            port: item.port,
            name: item.target
        }
    },
    'SOA': function(item) {
       return {
            nsname: item.primary,
            hostmaster: item.admin,
            serial: item.serial,
            refresh: item.refresh,
            retry: item.retry,
            expire: item.expiration,
            minttl: item.minimum
        }
    }
};

/** resolve
 */
Resolver.prototype.resolve = function(hostname, rrtype, callback) {
    var self = this
    if ((typeof callback === 'undefined') && (_.isFunction(rrtype))) {
        callback = rrtype
        rrtype = undefined
    }
    return self._normalizeRequestType(rrtype, function(err, type) {
        if (err) { return callback(err, []) }
        if (_dataConverters.hasOwnProperty(rrtype)) {
            var retriever = _dataConverters[rrtype]
            return self.request({
                name: hostname.toLowerCase(),
                type: type,
                class: self.defaultClass
            }, function(err, res) {
                if (err) { return callback(err, []) }
                var addresses = []
                var answer = res.answer || []
                answer.forEach(function(item) {
                    if (item.type == consts.NAME_TO_QTYPE[rrtype]) {
                        addresses.push(retriever(item))
                    }
                })
                callback(null, addresses)
            })
        } else {
            return self.errback(callback)(consts.NOTIMP, consts.NAME_TO_RCODE.NOTIMP, 'Unknown type "' + rrtype + '"')
        }
    })
}
Resolver.prototype.resolveAsync = Promise.promisify(Resolver.prototype.resolve)

var _resolveMethods = {
    '4': 'A',
    '6': 'AAAA',
    'Mx': 'MX',
    'Txt': 'TXT',
    'Srv': 'SRV',
    'Ns': 'NS',
    'Cname': 'CNAME'
}

function declareResolveMethod(method, record) {
    Resolver.prototype[method] = function(hostname, callback) {
        this.debug('Need to resolve %s/%s/%s', hostname, record, consts.QCLASS_TO_NAME[this.defaultClass])
        return this.resolve(hostname, record, callback)
    }
    Resolver.prototype[method + 'Async'] = Promise.promisify(Resolver.prototype[method])
}

for (var key in _resolveMethods) {
    var method = 'resolve' + key
    var record = _resolveMethods[key]
    declareResolveMethod(method, record)
}

Resolver.prototype.resolveSoa = function(hostname, callback) {
    this.debug('Need to resolve %s/%s/%s', hostname, 'SOA', consts.QCLASS_TO_NAME[this.defaultClass])
    return this.resolve(hostname, 'SOA', function(err, addresses) {
        if (err) { return callback(err) }
        callback(null, addresses[0])
    })
}
Resolver.prototype.resolveSoaAsync = Promise.promisify(Resolver.prototype.resolveSoa)

Resolver.prototype.reverse = function(address, callback) {
    var hostname = this.utils.reverseIp(address)
    this.debug('Need to resolve %s/%s/%s', hostname, 'PTR', consts.QCLASS_TO_NAME[this.defaultClass])
    return this.resolve(hostname, 'PTR', callback)
}
Resolver.prototype.reverseAsync = Promise.promisify(Resolver.prototype.reverse)

Resolver.prototype.lookupService = dns.lookupService

/* Module
============================================================================= */

var Module = function(opts) {
    this.consts = consts;
    this.utils = utils;
    
    this.BADNAME = consts.BADNAME;
    this.BADRESP = consts.BADRESP;
    this.CONNREFUSED = consts.CONNREFUSED;
    this.DESTRUCTION = consts.DESTRUCTION;
    this.REFUSED = consts.REFUSED;
    this.FORMERR = consts.FORMERR;
    this.NODATA = consts.NODATA;
    this.NOMEM = consts.NOMEM;
    this.NOTFOUND = consts.NOTFOUND;
    this.NOTIMP = consts.NOTIMP;
    this.SERVFAIL = consts.SERVFAIL;
    this.TIMEOUT = consts.TIMEOUT;

    this.ADDRCONFIG = dns.ADDRCONFIG
    this.V4MAPPED = dns.V4MAPPED

    this.Resolver = Resolver;
}

/* Exports
============================================================================= */

global.dnsjs = new Module()

module.exports = global.dnsjs
