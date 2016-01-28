/* $Id: xtools.js 2010.01.25 Rubel.Tools $
*******************************************************************************
              Copyright (c) 2009 - 2011 Tubz's workroom.
                          GNU - LGPL

                    @Project: Rubel v0.1
                    @Author:  风剑 zhliner@gmail.com
*******************************************************************************
    简介

    Rubel 框架的 Js 基本工具集。

&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/


(function() {

    var _isIE = (
        navigator.appName == "Microsoft Internet Explorer"
    );

    var _removeNode = _isIE ? function() {
        var d;
        return function(n) {
            if(n && n.tagName != 'BODY') {
                d = d || document.createElement('div');
                d.appendChild(n);
                d.innerHTML = '';
            }
        }
    }() : function(n) {
        if(n && n.parentNode && n.tagName != 'BODY') {
            n.parentNode.removeChild(n);
        }
    };


/* [ Request by window.name ]
 * ****************************************************************************
   借助 Window.name 实现 Js 的跨域访问。
   1、 url 向外传值， callback 处理返回结果。
   2、 返回页面中 JS 对 window.name 赋值。

   返回页
   <script language="JavaScript">
       window.name = ...  // 支持任意字符串，可达~2MB
   </script>

   若需同时进行多个请求，回调函数应是不同的函数实例（currying）。
   iframe 的自由载入形成了异步机制。
*/

    wnRequest = {
        _doc: document,
        _proxyUrl: 'proxy.html'
    };

    wnRequest.send = function( url, callback )
    {
        if(! url || typeof url !== 'string') {
            return;
        }
        url += (url.indexOf('?') > 0 ? '&' : '?') + 'windowname=get';

        var frame = this._doc.createElement('iframe');
        frame._state = 0;
        this._doc.body.appendChild(frame);
        frame.style.display = 'none';

        (function( el, type, fn ) {
            if (_isIE) {
                el.attachEvent('on' + type, fn);
            } else {
                el.addEventListener(type, fn, false);
            }
        })(frame, 'load', function() {
            if(frame._state === 1) {
                _getData(frame, callback);
            } else if(frame._state === 0) {
                frame._state = 1;
                frame.contentWindow.location = wnRequest._proxyUrl;
            }
        });

        frame.src = url;
    };

    //
    // 设置 url 域 Js 可访问的本地数据，客户端直接站间转递数据（无上传）。
    // 返回页：
    // <script type="text/javascript">
    //     if (window.name) {
    //         // 处理 name 值
    //         window.name = null;
    //     }
    //     // 升为顶级窗口
    //     try {
    //         top.location.hostname;
    //         if (top.location.hostname != window.location.hostname) {
    //             top.location.href =window.location.href;
    //         }
    //     } catch(e) {
    //         top.location.href = window.location.href;
    //     }
    // </script>
    //
    //
    wnRequest.setname = function( name, url ) {
        if(! url || typeof url !== 'string') {
            return;
        }
        url += (url.indexOf('?') > 0 ? '&' : '?') + 'windowname=loc';

        var frame = this._doc.createElement('iframe');
        frame._count = 0;
        this._doc.body.appendChild(frame);
        frame.style.display = 'none';
        if (_isIE) {
            frame.name = name;
        } else {
            frame.contentWindow.name = name;
        }
        frame.src = url;
    };

    //
    // 私用辅助
    //
    var _clear = function(frame) {
        try {
            frame.contentWindow.document.write('');
            frame.contentWindow.close();
            _removeNode(frame);
        } catch(e) {}
    }

    var _getData = function(frame, callback) {
        try {
            var da = frame.contentWindow.name;
        } catch(e) {}
        _clear(frame);
        if(callback && typeof callback === 'function') {
            callback(da);
        }
    }


/* [ String ]
 * ****************************************************************************
   对 String 做原生的简单扩展，以支持一些常用功能。
*/

    var _Charset = {
            'cjk': [ 'u4e00', 'u9fa5' ],    // 汉字 [一-龥]
            'num': [ 'u0030', 'u0039' ],    // 数字 [0-9]
            'lal': [ 'u0061', 'u007a' ],    // 小写字母 [a-z]
            'ual': [ 'u0041', 'u005a' ],    // 大写字母 [A-Z]
            'asc': [ 'u0020', 'u007e' ]     // ASCII 可视字符
        };

    //
    // 统计字符串显示长度（非 8 位字符当 2 个字节宽）。
    // @return int  - 串显长（8 位字节）
    //
    String.prototype._vbytes = function()
    {
        return  this.length + this.replace(/[\x00-\xff]/g,"").length;
    };


    //
    // 加密：字符码在字符集内平移。
    // 特点：
    // 1. 字串越短加密效果越好，若短文不大于密钥长度，则不可破解。
    // 2. 不增加文本的长度，即密文长度等于原文长度。
    // 缺点：
    // 1. 一次只能对“一个”连续值的字符集进行处理，而一般字符串中会
    //    同时包含多个字符集中的字符。
    // 2. 汉字平移后的字较生僻，明显体现出已被平移处理；
    // 推荐：
    // 适于特定类型的短字符串的处理，如：时间串、名称、标题等。
    //
    // 参数 cset：
    // 用 Unicode 表示 -- 4 位十六进制，前置‘u’，
    // 可用预定义的 _Charset 属性名标识，默认为 cjk。
    //
    // @param array na  - 平移量数组
    // @param array cset  - 字符集名/范围 [ 起点, 终点 ]）
    // @return string  - 平移后的字符串
    //
    String.prototype._shift = (function()
    {
        var _cset, _id, _beg, _len, _exp;

        return  function( na, cset ) {
            switch (typeof cset) {
                case 'undefined':
                    cset = 'cjk';
                case 'string':
                    _cset = (cset == _id) ? null : _Charset[cset];
                    break;
                default: _cset = cset;
            }
            if ( _cset ) {
                _beg = parseInt(_cset[0].substring(1), 16);
                _len = parseInt(_cset[1].substring(1), 16) - _beg + 1;
                _exp = RegExp('[\\' + _cset[0] + '-\\' + _cset[1] + ']', 'g');
                _id  = cset;
            }
            var _sz = na.length,
                _cnt = 0;
            return  this.replace(_exp, function(s) {
                var _c = s.charCodeAt(0) - _beg;
                return  String.fromCharCode((_c+na[_cnt++%_sz])%_len + _beg);
            });
        };
    })();


    //
    // 解密：字符码在字符集内平移-恢复。
    //
    String.prototype._unshift = (function()
    {
        var _cset, _id, _beg, _len, _exp;

        return  function( na, cset ) {
            switch (typeof cset) {
                case 'undefined':
                    cset = 'cjk';
                case 'string':
                    _cset = (cset == _id) ? null : _Charset[cset];
                    break;
                default: _cset = cset;
            }
            if ( _cset ) {
                _beg = parseInt(_cset[0].substring(1), 16);
                _len = parseInt(_cset[1].substring(1), 16) - _beg + 1;
                _exp = RegExp('[\\' + _cset[0] + '-\\' + _cset[1] + ']', 'g');
                _id  = cset;
            }
            var _sz = na.length,
                _cnt = 0;
            return  this.replace(_exp, function(s) {
                var _c = s.charCodeAt(0) - _beg;
                return  String.fromCharCode((_c-na[_cnt++%_sz]%_len+_len)%_len + _beg);
            });
        };
    })();


    //
    // alnum 特化版-加密
    // 字符集：
    // [0-9a-zA-Z] = 英文字母（大小写） + 数字
    //
    String.prototype._shift_en = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[0-9a-zA-Z]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x41,
                _len = 26;
            if (_n >= 0x61) {
                _beg = 0x61;
            } else if (_n < 0x41) {
                _beg = 0x30;
                _len = 10;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c+na[_cnt++%_sz])%_len + _beg);
        });
    };

    //
    // alnum 特化版-解密
    //
    String.prototype._unshift_en = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[0-9a-zA-Z]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x41,
                _len = 26;
            if (_n >= 0x61) {
                _beg = 0x61;
            } else if (_n < 0x41) {
                _beg = 0x30;
                _len = 10;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c-na[_cnt++%_sz]%_len+_len)%_len + _beg);
        });
    };


    //
    // 汉语文字环境特化版-加密
    // 字符集：
    // [0-9a-zA-Z\u4e00-\u9fa5] = CJK 统一汉字 + 英文字母（大小写） + 数字
    //
    String.prototype._shift_zh = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[0-9a-zA-Z\u4e00-\u9fa5]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x41,
                _len = 26;
            if (_n >= 0x4e00) {
                _beg = 0x4e00;
                _len = 20902;
            } else if (_n >= 0x61) {
                _beg = 0x61;
            } else if (_n < 0x41) {
                _beg = 0x30;
                _len = 10;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c+na[_cnt++%_sz])%_len + _beg);
        });
    };

    //
    // 汉语文字环境特化版-解密
    //
    String.prototype._unshift_zh = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[0-9a-zA-Z\u4e00-\u9fa5]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x41,
                _len = 26;
            if (_n >= 0x4e00) {
                _beg = 0x4e00;
                _len = 20902;
            } else if (_n >= 0x61) {
                _beg = 0x61;
            } else if (_n < 0x41) {
                _beg = 0x30;
                _len = 10;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c-na[_cnt++%_sz]%_len+_len)%_len + _beg);
        });
    };


    //
    // 中文环境字符特化版-加密
    // 字符集：
    // [\u0020-\u007e\u4e00-\u9fa5] = CJK 统一汉字 + ASCII 常规字符
    // 注：
    // \u0020 = 空格，\u007e = ~
    //
    String.prototype._shift_chs = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[\u0020-\u007e\u4e00-\u9fa5]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x20,
                _len = 95;
            if (_n >= 0x4e00) {
                _beg = 0x4e00;
                _len = 20902;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c+na[_cnt++%_sz])%_len + _beg);
        });
    };

    //
    // 中文环境字符特化版-解密
    //
    String.prototype._unshift_chs = function( na )
    {
        var _sz = na.length,
            _cnt = 0;
        return  this.replace(/[\u0020-\u007e\u4e00-\u9fa5]/g, function(s) {
            var _n = s.charCodeAt(0),
                _beg = 0x20,
                _len = 95;
            if (_n >= 0x4e00) {
                _beg = 0x4e00;
                _len = 20902;
            }
            var _c = _n - _beg;
            return  String.fromCharCode((_c-na[_cnt++%_sz]%_len+_len)%_len + _beg);
        });
    };


    //
    // 相邻 2 个汉字交换处理。
    // 执行一次交换，再执行一次恢复。
    // 特点：
    // 简单高效，但无加密作用，仅用于扰乱观读。
    //
    String.prototype._swap_cjk = function()
    {
        return  this.replace(/([\u4e00-\u9fa5])([\u4e00-\u9fa5])/g, '$2$1');
    };


    //
    // 字符错位-加密：
    // 密钥长 ≥16，循环步长 10， 末尾余量反向对齐错位。
    // 特点：
    // 1. 密文为字符串中现有的字符，不易被检测出已加密；
    // 2. 可适用于任意字符集；
    // 3. 不增加文本的长度，即密文长度等于原文长度。
    // 缺点：
    // 1. 原文不应有固定特征，如 html 标签，否则易破解；
    // 2. 原文长度必须不小于密钥长度。
    // 推荐：
    // 适用于较长的文本处理，一般为文章的正文段落。
    //
    // @param array key  - 0-N 连续数字随机排布
    // @return string    - 加密后的字符串
    //
    String.prototype._displace = function( key )
    {
        if (key.length < 16 || this.length < key.length)
            return  false;

        var _pos = key.length, _buf = new Array(_pos);

        var _sect = function(s) {
            for (var _i=0; _i<key.length; ++_i) {
                _buf[_i] = s.charAt(key[_i]);
            }
            return  [ _buf.slice(0, 10).join(''), _buf.slice(10).join('') ];
        };

        // _bs: back-string
        var _arr = _sect(this), _to = _arr[0], _bs = this.length - _pos;

        while (_bs >= 10) {
            _arr = _sect( _arr[1] + this.substring(_pos, _pos + 10) );
            _pos += 10;
            _to += _arr[0];
            _bs = this.length - _pos;
        }
        _to += _arr[1];

        // 末尾余量处理
        if (_bs > 0) {
            var _ep = this.length - key.length;
            _arr = _sect(_to.substring(_ep) + this.substring(_pos));
            _to = _to.substring(0, _ep) + _arr.join('');
        }

        return  _to;
    };


    //
    // 字符错位-解密： 从尾至头逆向计算
    //
    // @return string  - 解密后的字符串
    //
    String.prototype._undisplace = function( key )
    {
        if (key.length < 16) return  false;

        var _buf = new Array(_pos),
            _s2  = key.length - 10,  // 重叠长
            _pos = parseInt((this.length - key.length) / 10) * 10 + key.length;

        var _sect = function(s) {
            for (var _i=0; _i<key.length; ++_i) {
                _buf[key[_i]] = s.charAt(_i);
            }
            // [重叠段, 有效段]
            return  [ _buf.slice(0, _s2).join(''), _buf.slice(_s2).join('') ];
        };

        return  (function(s) {
            var _to = '', _arr = null;
            // 末尾余量
            if (_pos < s.length) {
                _arr = _sect(s.slice(-key.length));
                _to = _arr[1].slice(_pos - s.length);
                s = s.slice(0, -key.length) + _arr[0] + _arr[1].slice(0, _pos - s.length);
            }
            _pos -= key.length;
            _arr = _sect(s.slice(_pos));
            _to = _arr[1] + _to;
            _pos -= 10;
            while (_pos >= 0) {
                _arr = _sect( s.substring(_pos, _pos + 10) + _arr[0] );
                _pos -= 10;
                _to = _arr[1] + _to;
            }

            return  _arr[0] + _to;

        })(this);
    };


    //
    // 进制转换-加密：
    // 采用 [a-zA-Z] 52 个字符随机排列成进制表，对字符的值进行转换。
    // 固定 3 位字符，41 进制，字符值最大可为 68920（> 65535）。
    // 特点：
    // 1. 密文为纯大小写英文字母，及原有的 [\s\n\r]；
    // 2. 增加了平移操作，双重加密；
    // 3. key[0-40] 为进制表，逆向 16-25 位作为平移密钥；
    // 4. 进制表段字符不可重复。
    // 5. 空白、换行和回车 [\s\n\r] 不加密。
    // 缺点：
    // 密文会比原文长，单字节字符会增长得较多。
    // 推荐：
    // 适用于任意类型的文本加密，网络环境可采用压缩传输；
    // 注意：
    // key 字符串不能含非 [a-zA-Z] 字符（关联数组）。
    //
    // @param string key  - 进制表串（length >= 41）
    // @return string  - 转换后的字符串
    //
    String.prototype._41hex = (function()
    {
        var _k, _k2, _sz;

        return  function( key ) {
            if (key.length < 41)  return null;

            if (_k != key) {
                _sz = key.charCodeAt(40) % 10 + 16,
                _k2 = key.slice(-_sz).split('');
                for (var _i=0; _i<_sz; ++_i) {
                    _k2[_i] = _k2[_i].charCodeAt(0);
                }
                _k = key;
            }
            var _cnt = 0;
            return  this.replace(/[^\s\n\r]/g, function(s) {
                var _n = s.charCodeAt(0);
                return  key.charAt(parseInt(_n/1681)) + key.charAt(parseInt(_n%1681/41)) + key.charAt(_n%41);

            }).replace(/[a-zA-Z]/g, function(s) {
                var _n = s.charCodeAt(0),
                    _beg = (_n < 0x61) ? 0x41 : 0x61,
                    _c = _n - _beg;
                return  String.fromCharCode((_c+_k2[_cnt++%_sz])%26 + _beg);
            });
        };
    })();

    //
    // 进制转换-解密
    // @return string  - 恢复后的字符串
    //
    String.prototype._un41hex = (function()
    {
        var _k, _k2 = [], _sz, _tbl = {};

        return  function( key ) {
            if (key.length < 41)  return null;

            if (_k != key) {
                // 逆向，防止属性值覆盖
                for (var _i=key.length-1; _i>=0; --_i) {
                    _tbl[key.charAt(_i)] = _i;
                    _k2[_i] = key.charCodeAt(_i);
                }
                _sz = _k2[40] % 10 + 16;
                _k2 = _k2.slice(-_sz);
                _k  = key;
            }
            var _cnt = 0;
            return  this.replace(/[a-zA-Z]/g, function(s) {
                var _n = s.charCodeAt(0),
                    _beg = (_n < 0x61) ? 0x41 : 0x61,
                    _c = _n - _beg;
                return  String.fromCharCode((_c-_k2[_cnt++%_sz]%26+26)%26 + _beg);

            }).replace(/[a-zA-Z]{3}/g, function(s) {
                var _n = _tbl[s.charAt(0)]*1681 + _tbl[s.charAt(1)]*41 + _tbl[s.charAt(2)];
                return  String.fromCharCode(_n);
            });
        };
    })();


    //
    // 进制转换：单字节字符版本-加密。
    // 采用 16 进制，固定 2 个字符。
    // 特点：
    // 值大于 0xff 的字符会原样保留，即不加密非拉丁字符。
    //
    // @param string key  - 进制表串（length >= 16）
    // @return string  - 转换后的字符串
    //
    String.prototype._16hex = (function()
    {
        var _k, _k2, _sz;

        return  function( key ) {
            if (key.length < 16)  return null;

            if (_k != key) {
                // 加强平移密钥
                _sz = key.charCodeAt(15) % (key.length-6) + 6,
                _k2 = key.slice(-_sz).split('');
                for (var _i=0; _i<_sz; ++_i) {
                    _k2[_i] = _k2[_i].charCodeAt(0);
                }
                _k = key;
            }
            var _cnt = 0;
            return  this.replace(/[\x21-\xff]/g, function(s) {
                var _n = s.charCodeAt(0);
                return  key.charAt(parseInt(_n/16)) + key.charAt(_n%16);

            }).replace(/[a-zA-Z]/g, function(s) {
                var _n = s.charCodeAt(0),
                    _beg = (_n < 0x61) ? 0x41 : 0x61,
                    _c = _n - _beg;
                return  String.fromCharCode((_c+_k2[_cnt++%_sz])%26 + _beg);
            });
        };
    })();

    //
    // 进制转换：单字节字符版本-解密
    // @return string  - 恢复后的字符串
    //
    String.prototype._un16hex = (function()
    {
        var _k, _k2 = [], _sz, _tbl = {};

        return  function( key ) {
            if (key.length < 16)  return null;

            if (_k != key) {
                // 逆向，防止属性值覆盖
                for (var _i=key.length-1; _i>=0; --_i) {
                    _tbl[key.charAt(_i)] = _i;
                    _k2[_i] = key.charCodeAt(_i);
                }
                _sz = _k2[15] % (key.length-6) + 6;
                _k2 = _k2.slice(-_sz);
                _k  = key;
            }
            var _cnt = 0;
            return  this.replace(/[a-zA-Z]/g, function(s) {
                var _n = s.charCodeAt(0),
                    _beg = (_n < 0x61) ? 0x41 : 0x61,
                    _c = _n - _beg;
                return  String.fromCharCode((_c-_k2[_cnt++%_sz]%26+26)%26 + _beg);

            }).replace(/[a-zA-Z]{2}/g, function(s) {
                var _n = _tbl[s.charAt(0)]*16 + _tbl[s.charAt(1)];
                return  String.fromCharCode(_n);
            });
        };
    })();

})();
