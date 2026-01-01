var init = (() => {
	var _scriptName =
		typeof document != "undefined" ? document.currentScript?.src : undefined;

	return (moduleArg = {}) => {
		var moduleRtn;

		function f() {
			p.buffer != q.buffer && r();
			return q;
		}
		function aa() {
			p.buffer != q.buffer && r();
			return ba;
		}
		function ca() {
			p.buffer != q.buffer && r();
			return da;
		}
		function t() {
			p.buffer != q.buffer && r();
			return ea;
		}
		function u() {
			p.buffer != q.buffer && r();
			return fa;
		}
		function ha() {
			p.buffer != q.buffer && r();
			return ia;
		}
		var w = moduleArg,
			ja,
			ka,
			la = new Promise((a, b) => {
				ja = a;
				ka = b;
			}),
			y = self.name?.startsWith("em-pthread");
		w.noInitialRun = !0;
		w.locateFile && (_scriptName = w.locateFile("qpdf.js"));
		var na = Object.assign({}, w),
			oa = [],
			z = "",
			pa,
			qa;
		z = self.location.href;
		_scriptName && (z = _scriptName);
		z.startsWith("blob:")
			? (z = "")
			: (z = z.substr(0, z.replace(/[?#].*/, "").lastIndexOf("/") + 1));
		qa = (a) => {
			var b = new XMLHttpRequest();
			b.open("GET", a, !1);
			b.responseType = "arraybuffer";
			b.send(null);
			return new Uint8Array(b.response);
		};
		pa = (a) =>
			fetch(a, { credentials: "same-origin" }).then((b) =>
				b.ok
					? b.arrayBuffer()
					: Promise.reject(Error(b.status + " : " + b.url)),
			);
		var ra = console.log.bind(console),
			A = console.error.bind(console);
		Object.assign(w, na);
		na = null;
		var p,
			sa,
			ta = !1,
			ua,
			q,
			ba,
			da,
			ea,
			fa,
			ia;
		function r() {
			var a = p.buffer;
			w.HEAP8 = q = new Int8Array(a);
			w.HEAP16 = da = new Int16Array(a);
			w.HEAPU8 = ba = new Uint8Array(a);
			w.HEAPU16 = new Uint16Array(a);
			w.HEAP32 = ea = new Int32Array(a);
			w.HEAPU32 = fa = new Uint32Array(a);
			w.HEAPF32 = new Float32Array(a);
			w.HEAPF64 = ia = new Float64Array(a);
		}
		if (y) {
			var va,
				wa = !1;
			A = (...b) => {
				console.error(b.join(" "));
			};
			self.alert = (...b) => {
				postMessage({ cb: "alert", text: b.join(" "), Mc: xa() });
			};
			self.onunhandledrejection = (b) => {
				throw b.reason || b;
			};
			function a(b) {
				try {
					var c = b.data,
						d = c.cb;
					if ("load" === d) {
						const e = [];
						self.onmessage = (g) => e.push(g);
						self.startWorker = () => {
							postMessage({ cb: "loaded" });
							for (const g of e) a(g);
							self.onmessage = a;
						};
						for (const g of c.Ec)
							if (!w[g] || w[g].proxy)
								(w[g] = (...h) => {
									postMessage({ cb: "callHandler", Dc: g, uc: h });
								}),
									"print" == g && (ra = w[g]),
									"printErr" == g && (A = w[g]);
						p = c.Qc;
						r();
						va(c.Rc);
					} else if ("run" === d) {
						ya(c.gb);
						za(c.gb, 0, 0, 1, 0, 0);
						Aa();
						Ba(c.gb);
						wa ||= !0;
						try {
							Ca(c.Kc, c.Xb);
						} catch (e) {
							if ("unwind" != e) throw e;
						}
					} else
						"setimmediate" !== c.target &&
							("checkMailbox" === d
								? wa && Da()
								: d && (A(`worker: received unknown command ${d}`), A(c)));
				} catch (e) {
					throw (Ea(), e);
				}
			}
			self.onmessage = a;
		}
		y ||
			((p = new WebAssembly.Memory({
				initial: 1024,
				maximum: 32768,
				shared: !0,
			})),
			r());
		var Fa = [],
			Ga = [],
			Ha = [],
			Ia = [];
		function Ja() {
			y || (w.noFSInit || B.Kb || B.vb(), (B.Jb = !1), Ka(Ga));
		}
		var C = 0,
			La = null,
			Ma = null;
		function Na() {
			C--;
			if (0 == C && (null !== La && (clearInterval(La), (La = null)), Ma)) {
				var a = Ma;
				Ma = null;
				a();
			}
		}
		function D(a) {
			a = "Aborted(" + a + ")";
			A(a);
			ta = !0;
			a = new WebAssembly.RuntimeError(
				a + ". Build with -sASSERTIONS for more info.",
			);
			ka(a);
			throw a;
		}
		var Oa = (a) => a.startsWith("data:application/octet-stream;base64,"),
			Pa;
		function Qa(a) {
			return pa(a).then(
				(b) => new Uint8Array(b),
				() => {
					if (qa) var b = qa(a);
					else throw "both async and sync fetching of the wasm failed";
					return b;
				},
			);
		}
		function Ra(a, b, c) {
			return Qa(a)
				.then((d) => WebAssembly.instantiate(d, b))
				.then(c, (d) => {
					A(`failed to asynchronously prepare wasm: ${d}`);
					D(d);
				});
		}
		function Sa(a, b) {
			var c = Pa;
			return "function" != typeof WebAssembly.instantiateStreaming ||
				Oa(c) ||
				"function" != typeof fetch
				? Ra(c, a, b)
				: fetch(c, { credentials: "same-origin" }).then((d) =>
						WebAssembly.instantiateStreaming(d, a).then(b, (e) => {
							A(`wasm streaming compile failed: ${e}`);
							A("falling back to ArrayBuffer instantiation");
							return Ra(c, a, b);
						}),
					);
		}
		function Ta() {
			Ua = {
				n: Va,
				o: Wa,
				d: Xa,
				j: Ya,
				q: Za,
				A: $a,
				b: ab,
				X: bb,
				g: cb,
				C: db,
				ka: eb,
				D: fb,
				ba: gb,
				aa: hb,
				_: ib,
				Y: jb,
				fa: kb,
				$: lb,
				da: mb,
				U: nb,
				W: ob,
				ea: Ba,
				F: pb,
				P: qb,
				I: rb,
				V: sb,
				S: tb,
				ca: ub,
				K: vb,
				E: wb,
				u: xb,
				Z: yb,
				ga: zb,
				ha: Ab,
				t: Bb,
				B: Cb,
				ja: Db,
				J: Eb,
				ia: Fb,
				L: Gb,
				c: Hb,
				e: Ib,
				m: Jb,
				O: Kb,
				M: Lb,
				N: Mb,
				p: Nb,
				x: Ob,
				w: Pb,
				H: Qb,
				G: Rb,
				i: Sb,
				h: Tb,
				f: Ub,
				k: Vb,
				l: Wb,
				R: Xb,
				Q: Yb,
				r: Zb,
				z: $b,
				s: ac,
				v: bc,
				y: cc,
				a: p,
				T: dc,
			};
			return { a: Ua };
		}
		var G, J;
		class ec {
			name = "ExitStatus";
			constructor(a) {
				this.message = `Program terminated with exit(${a})`;
				this.status = a;
			}
		}
		var fc = (a) => {
				a.terminate();
				a.onmessage = () => {};
			},
			gc = 0,
			N = (a, b, ...c) => {
				for (
					var d = c.length, e = K(), g = hc(8 * d), h = g >> 3, k = 0;
					k < c.length;
					k++
				) {
					var m = c[k];
					ha()[h + k] = m;
				}
				a = ic(a, 0, d, g, b);
				M(e);
				return a;
			};
		function dc(a) {
			if (y) return N(0, 1, a);
			ua = a;
			if (!(jc || 0 < gc)) {
				for (var b of kc) fc(b);
				for (b of lc) fc(b);
				lc = [];
				kc = [];
				mc = {};
				w.onExit?.(a);
				ta = !0;
			}
			throw new ec(a);
		}
		var nc = (a) => {
			if (a instanceof ec || "unwind" == a) return ua;
			throw a;
		};
		function oc(a) {
			if (y) return N(1, 0, a);
			Bb(a);
		}
		var Bb = (a) => {
				ua = a;
				if (y) throw (oc(a), "unwind");
				dc(a);
			},
			lc = [],
			kc = [],
			pc = [],
			mc = {};
		function qc() {
			for (var a = navigator.hardwareConcurrency; a--; ) rc();
			Fa.unshift(() => {
				C++;
				sc(() => Na());
			});
		}
		var uc = (a) => {
			var b = a.gb;
			delete mc[b];
			lc.push(a);
			kc.splice(kc.indexOf(a), 1);
			a.gb = 0;
			tc(b);
		};
		function Aa() {
			pc.forEach((a) => a());
		}
		var vc = (a) =>
			new Promise((b) => {
				a.onmessage = (g) => {
					g = g.data;
					var h = g.cb;
					if (g.Bb && g.Bb != xa()) {
						var k = mc[g.Bb];
						k
							? k.postMessage(g, g.Nc)
							: A(
									`Internal error! Worker sent a message "${h}" to target pthread ${g.Bb}, but that thread no longer exists!`,
								);
					} else if ("checkMailbox" === h) Da();
					else if ("spawnThread" === h) {
						if ((0 == lc.length && (rc(), vc(lc[0])), (h = lc.pop())))
							kc.push(h),
								(mc[g.gb] = h),
								(h.gb = g.gb),
								h.postMessage(
									{ cb: "run", Kc: g.ud, Xb: g.Xb, gb: g.gb },
									g.Nc,
								);
					} else if ("cleanupThread" === h) uc(mc[g.Lc]);
					else if ("loaded" === h) (a.loaded = !0), b(a);
					else if ("alert" === h) alert(`Thread ${g.Mc}: ${g.text}`);
					else if ("setimmediate" === g.target) a.postMessage(g);
					else if ("callHandler" === h) w[g.Dc](...g.uc);
					else h && A(`worker sent an unknown command ${h}`);
				};
				a.onerror = (g) => {
					A(
						`${"worker sent an error!"} ${g.filename}:${g.lineno}: ${g.message}`,
					);
					throw g;
				};
				var c = [],
					d = ["onExit"],
					e;
				for (e of d) w.propertyIsEnumerable(e) && c.push(e);
				a.postMessage({ cb: "load", Ec: c, Qc: p, Rc: sa });
			});
		function sc(a) {
			y ? a() : Promise.all(lc.map(vc)).then(a);
		}
		function rc() {
			var a = new Worker(_scriptName, { type: "module", name: "em-pthread" });
			lc.push(a);
		}
		var Ka = (a) => {
				for (; 0 < a.length; ) a.shift()(w);
			},
			ya = (a) => {
				r();
				var b = u()[(a + 52) >> 2];
				a = u()[(a + 56) >> 2];
				wc(b, b - a);
				M(b);
			},
			O,
			Ca = (a, b) => {
				jc = gc = 0;
				a = O.get(a)(b);
				jc || 0 < gc ? (ua = a) : xc(a);
			},
			jc = w.noExitRuntime || !0,
			yc = [],
			zc = 0,
			Va = (a) => {
				var b = new Ac(a);
				if (0 == f()[b.Ta + 12]) {
					var c = 1;
					f()[b.Ta + 12] = c;
					zc--;
				}
				c = 0;
				f()[b.Ta + 13] = c;
				yc.push(b);
				Bc(a);
				return Cc(a);
			},
			Dc = 0,
			Wa = () => {
				Q(0, 0);
				var a = yc.pop();
				Ec(a.fc);
				Dc = 0;
			};
		class Ac {
			constructor(a) {
				this.fc = a;
				this.Ta = a - 24;
			}
			vb(a, b) {
				u()[(this.Ta + 16) >> 2] = 0;
				u()[(this.Ta + 4) >> 2] = a;
				u()[(this.Ta + 8) >> 2] = b;
			}
		}
		var cb = (a) => {
				Dc ||= a;
				throw Dc;
			},
			Hc = (a) => {
				var b = Dc;
				if (!b) return Fc(0), 0;
				var c = new Ac(b);
				u()[(c.Ta + 16) >> 2] = b;
				var d = u()[(c.Ta + 4) >> 2];
				if (!d) return Fc(0), b;
				for (var e of a) {
					if (0 === e || e === d) break;
					if (Gc(e, d, c.Ta + 16)) return Fc(e), b;
				}
				Fc(d);
				return b;
			},
			Xa = () => Hc([]),
			Ya = (a) => Hc([a]),
			Za = (a, b) => Hc([a, b]),
			$a = () => {
				var a = yc.pop();
				a || D("no exception to throw");
				var b = a.fc;
				if (0 == f()[a.Ta + 13]) {
					yc.push(a);
					var c = 1;
					f()[a.Ta + 13] = c;
					c = 0;
					f()[a.Ta + 12] = c;
					zc++;
				}
				Dc = b;
				throw Dc;
			},
			ab = (a, b, c) => {
				new Ac(a).vb(b, c);
				Dc = a;
				zc++;
				throw Dc;
			},
			bb = () => zc,
			R = () => {
				var a = t()[+Ic >> 2];
				Ic += 4;
				return a;
			},
			Jc = (a, b) => {
				for (var c = 0, d = a.length - 1; 0 <= d; d--) {
					var e = a[d];
					"." === e
						? a.splice(d, 1)
						: ".." === e
							? (a.splice(d, 1), c++)
							: c && (a.splice(d, 1), c--);
				}
				if (b) for (; c; c--) a.unshift("..");
				return a;
			},
			S = (a) => {
				var b = "/" === a.charAt(0),
					c = "/" === a.substr(-1);
				(a = Jc(
					a.split("/").filter((d) => !!d),
					!b,
				).join("/")) ||
					b ||
					(a = ".");
				a && c && (a += "/");
				return (b ? "/" : "") + a;
			},
			Kc = (a) => {
				var b = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/
					.exec(a)
					.slice(1);
				a = b[0];
				b = b[1];
				if (!a && !b) return ".";
				b &&= b.substr(0, b.length - 1);
				return a + b;
			},
			Lc = (a) => {
				if ("/" === a) return "/";
				a = S(a);
				a = a.replace(/\/$/, "");
				var b = a.lastIndexOf("/");
				return -1 === b ? a : a.substr(b + 1);
			},
			Mc = (a, b) => S(a + "/" + b),
			Nc = () => {
				if (
					"object" == typeof crypto &&
					"function" == typeof crypto.getRandomValues
				)
					return (a) => (
						a.set(crypto.getRandomValues(new Uint8Array(a.byteLength))), a
					);
				D("initRandomDevice");
			},
			Oc = (a) => (Oc = Nc())(a),
			Pc = (...a) => {
				for (var b = "", c = !1, d = a.length - 1; -1 <= d && !c; d--) {
					c = 0 <= d ? a[d] : B.Gb();
					if ("string" != typeof c)
						throw new TypeError("Arguments to path.resolve must be strings");
					if (!c) return "";
					b = c + "/" + b;
					c = "/" === c.charAt(0);
				}
				b = Jc(
					b.split("/").filter((e) => !!e),
					!c,
				).join("/");
				return (c ? "/" : "") + b || ".";
			},
			Qc = (a, b) => {
				function c(h) {
					for (var k = 0; k < h.length && "" === h[k]; k++);
					for (var m = h.length - 1; 0 <= m && "" === h[m]; m--);
					return k > m ? [] : h.slice(k, m - k + 1);
				}
				a = Pc(a).substr(1);
				b = Pc(b).substr(1);
				a = c(a.split("/"));
				b = c(b.split("/"));
				for (var d = Math.min(a.length, b.length), e = d, g = 0; g < d; g++)
					if (a[g] !== b[g]) {
						e = g;
						break;
					}
				d = [];
				for (g = e; g < a.length; g++) d.push("..");
				d = d.concat(b.slice(e));
				return d.join("/");
			},
			Rc = "undefined" != typeof TextDecoder ? new TextDecoder() : void 0,
			Sc = (a, b = 0) => {
				for (var c = b + NaN, d = b; a[d] && !(d >= c); ) ++d;
				if (16 < d - b && a.buffer && Rc) return Rc.decode(a.slice(b, d));
				for (c = ""; b < d; ) {
					var e = a[b++];
					if (e & 128) {
						var g = a[b++] & 63;
						if (192 == (e & 224)) c += String.fromCharCode(((e & 31) << 6) | g);
						else {
							var h = a[b++] & 63;
							e =
								224 == (e & 240)
									? ((e & 15) << 12) | (g << 6) | h
									: ((e & 7) << 18) | (g << 12) | (h << 6) | (a[b++] & 63);
							65536 > e
								? (c += String.fromCharCode(e))
								: ((e -= 65536),
									(c += String.fromCharCode(
										55296 | (e >> 10),
										56320 | (e & 1023),
									)));
						}
					} else c += String.fromCharCode(e);
				}
				return c;
			},
			Tc = [],
			Uc = (a) => {
				for (var b = 0, c = 0; c < a.length; ++c) {
					var d = a.charCodeAt(c);
					127 >= d
						? b++
						: 2047 >= d
							? (b += 2)
							: 55296 <= d && 57343 >= d
								? ((b += 4), ++c)
								: (b += 3);
				}
				return b;
			},
			Vc = (a, b, c, d) => {
				if (!(0 < d)) return 0;
				var e = c;
				d = c + d - 1;
				for (var g = 0; g < a.length; ++g) {
					var h = a.charCodeAt(g);
					if (55296 <= h && 57343 >= h) {
						var k = a.charCodeAt(++g);
						h = (65536 + ((h & 1023) << 10)) | (k & 1023);
					}
					if (127 >= h) {
						if (c >= d) break;
						b[c++] = h;
					} else {
						if (2047 >= h) {
							if (c + 1 >= d) break;
							b[c++] = 192 | (h >> 6);
						} else {
							if (65535 >= h) {
								if (c + 2 >= d) break;
								b[c++] = 224 | (h >> 12);
							} else {
								if (c + 3 >= d) break;
								b[c++] = 240 | (h >> 18);
								b[c++] = 128 | ((h >> 12) & 63);
							}
							b[c++] = 128 | ((h >> 6) & 63);
						}
						b[c++] = 128 | (h & 63);
					}
				}
				b[c] = 0;
				return c - e;
			},
			Wc = [];
		function Xc(a, b) {
			Wc[a] = { input: [], Sa: [], fb: b };
			Yc(a, Zc);
		}
		var Zc = {
				open(a) {
					var b = Wc[a.node.rb];
					if (!b) throw new B.Ja(43);
					a.Na = b;
					a.seekable = !1;
				},
				close(a) {
					a.Na.fb.yb(a.Na);
				},
				yb(a) {
					a.Na.fb.yb(a.Na);
				},
				read(a, b, c, d) {
					if (!a.Na || !a.Na.fb.hc) throw new B.Ja(60);
					for (var e = 0, g = 0; g < d; g++) {
						try {
							var h = a.Na.fb.hc(a.Na);
						} catch (k) {
							throw new B.Ja(29);
						}
						if (void 0 === h && 0 === e) throw new B.Ja(6);
						if (null === h || void 0 === h) break;
						e++;
						b[c + g] = h;
					}
					e && (a.node.timestamp = Date.now());
					return e;
				},
				write(a, b, c, d) {
					if (!a.Na || !a.Na.fb.Qb) throw new B.Ja(60);
					try {
						for (var e = 0; e < d; e++) a.Na.fb.Qb(a.Na, b[c + e]);
					} catch (g) {
						throw new B.Ja(29);
					}
					d && (a.node.timestamp = Date.now());
					return e;
				},
			},
			$c = {
				hc() {
					return Tc.length ? Tc.shift() : null;
				},
				Qb(a, b) {
					null === b || 10 === b
						? (ra(Sc(a.Sa)), (a.Sa = []))
						: 0 != b && a.Sa.push(b);
				},
				yb(a) {
					a.Sa && 0 < a.Sa.length && (ra(Sc(a.Sa)), (a.Sa = []));
				},
				Fc() {
					return {
						Zc: 25856,
						ad: 5,
						Yc: 191,
						$c: 35387,
						Xc: [
							3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0,
							0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
						],
					};
				},
				Gc() {
					return 0;
				},
				Hc() {
					return [24, 80];
				},
			},
			ad = {
				Qb(a, b) {
					null === b || 10 === b
						? (A(Sc(a.Sa)), (a.Sa = []))
						: 0 != b && a.Sa.push(b);
				},
				yb(a) {
					a.Sa && 0 < a.Sa.length && (A(Sc(a.Sa)), (a.Sa = []));
				},
			};
		function bd(a, b) {
			var c = a.La ? a.La.length : 0;
			c >= b ||
				((b = Math.max(b, (c * (1048576 > c ? 2 : 1.125)) >>> 0)),
				0 != c && (b = Math.max(b, 256)),
				(c = a.La),
				(a.La = new Uint8Array(b)),
				0 < a.Pa && a.La.set(c.subarray(0, a.Pa), 0));
		}
		var T = {
				ab: null,
				Oa() {
					return T.createNode(null, "/", 16895, 0);
				},
				createNode(a, b, c, d) {
					var e;
					(e = 24576 === (c & 61440)) || (e = 4096 === (c & 61440));
					if (e) throw new B.Ja(63);
					T.ab ||
						(T.ab = {
							dir: {
								node: {
									Xa: T.Ka.Xa,
									Qa: T.Ka.Qa,
									ib: T.Ka.ib,
									Za: T.Ka.Za,
									nb: T.Ka.nb,
									pb: T.Ka.pb,
									ob: T.Ka.ob,
									sb: T.Ka.sb,
									hb: T.Ka.hb,
								},
								stream: { Ua: T.Ma.Ua },
							},
							file: {
								node: { Xa: T.Ka.Xa, Qa: T.Ka.Qa },
								stream: {
									Ua: T.Ma.Ua,
									read: T.Ma.read,
									write: T.Ma.write,
									ub: T.Ma.ub,
									qb: T.Ma.qb,
									xb: T.Ma.xb,
								},
							},
							link: {
								node: { Xa: T.Ka.Xa, Qa: T.Ka.Qa, mb: T.Ka.mb },
								stream: {},
							},
							$b: { node: { Xa: T.Ka.Xa, Qa: T.Ka.Qa }, stream: B.xc },
						});
					c = B.createNode(a, b, c, d);
					U(c.mode)
						? ((c.Ka = T.ab.dir.node), (c.Ma = T.ab.dir.stream), (c.La = {}))
						: B.isFile(c.mode)
							? ((c.Ka = T.ab.file.node),
								(c.Ma = T.ab.file.stream),
								(c.Pa = 0),
								(c.La = null))
							: 40960 === (c.mode & 61440)
								? ((c.Ka = T.ab.link.node), (c.Ma = T.ab.link.stream))
								: 8192 === (c.mode & 61440) &&
									((c.Ka = T.ab.$b.node), (c.Ma = T.ab.$b.stream));
					c.timestamp = Date.now();
					a && ((a.La[b] = c), (a.timestamp = c.timestamp));
					return c;
				},
				md(a) {
					return a.La
						? a.La.subarray
							? a.La.subarray(0, a.Pa)
							: new Uint8Array(a.La)
						: new Uint8Array(0);
				},
				Ka: {
					Xa(a) {
						var b = {};
						b.cc = 8192 === (a.mode & 61440) ? a.id : 1;
						b.Lb = a.id;
						b.mode = a.mode;
						b.nc = 1;
						b.uid = 0;
						b.ic = 0;
						b.rb = a.rb;
						U(a.mode)
							? (b.size = 4096)
							: B.isFile(a.mode)
								? (b.size = a.Pa)
								: 40960 === (a.mode & 61440)
									? (b.size = a.link.length)
									: (b.size = 0);
						b.Yb = new Date(a.timestamp);
						b.mc = new Date(a.timestamp);
						b.ac = new Date(a.timestamp);
						b.Zb = 4096;
						b.Fb = Math.ceil(b.size / b.Zb);
						return b;
					},
					Qa(a, b) {
						void 0 !== b.mode && (a.mode = b.mode);
						void 0 !== b.timestamp && (a.timestamp = b.timestamp);
						if (void 0 !== b.size && ((b = b.size), a.Pa != b))
							if (0 == b) (a.La = null), (a.Pa = 0);
							else {
								var c = a.La;
								a.La = new Uint8Array(b);
								c && a.La.set(c.subarray(0, Math.min(b, a.Pa)));
								a.Pa = b;
							}
					},
					ib() {
						throw T.ec;
					},
					Za(a, b, c, d) {
						return T.createNode(a, b, c, d);
					},
					nb(a, b, c) {
						if (U(a.mode)) {
							try {
								var d = V(b, c);
							} catch (g) {}
							if (d) for (var e in d.La) throw new B.Ja(55);
						}
						delete a.parent.La[a.name];
						a.parent.timestamp = Date.now();
						a.name = c;
						b.La[c] = a;
						b.timestamp = a.parent.timestamp;
					},
					pb(a, b) {
						delete a.La[b];
						a.timestamp = Date.now();
					},
					ob(a, b) {
						var c = V(a, b),
							d;
						for (d in c.La) throw new B.Ja(55);
						delete a.La[b];
						a.timestamp = Date.now();
					},
					sb(a) {
						var b = [".", ".."],
							c;
						for (c of Object.keys(a.La)) b.push(c);
						return b;
					},
					hb(a, b, c) {
						a = T.createNode(a, b, 41471, 0);
						a.link = c;
						return a;
					},
					mb(a) {
						if (40960 !== (a.mode & 61440)) throw new B.Ja(28);
						return a.link;
					},
				},
				Ma: {
					read(a, b, c, d, e) {
						var g = a.node.La;
						if (e >= a.node.Pa) return 0;
						a = Math.min(a.node.Pa - e, d);
						if (8 < a && g.subarray) b.set(g.subarray(e, e + a), c);
						else for (d = 0; d < a; d++) b[c + d] = g[e + d];
						return a;
					},
					write(a, b, c, d, e, g) {
						b.buffer === f().buffer && (g = !1);
						if (!d) return 0;
						a = a.node;
						a.timestamp = Date.now();
						if (b.subarray && (!a.La || a.La.subarray)) {
							if (g) return (a.La = b.subarray(c, c + d)), (a.Pa = d);
							if (0 === a.Pa && 0 === e)
								return (a.La = b.slice(c, c + d)), (a.Pa = d);
							if (e + d <= a.Pa) return a.La.set(b.subarray(c, c + d), e), d;
						}
						bd(a, e + d);
						if (a.La.subarray && b.subarray) a.La.set(b.subarray(c, c + d), e);
						else for (g = 0; g < d; g++) a.La[e + g] = b[c + g];
						a.Pa = Math.max(a.Pa, e + d);
						return d;
					},
					Ua(a, b, c) {
						1 === c
							? (b += a.position)
							: 2 === c && B.isFile(a.node.mode) && (b += a.node.Pa);
						if (0 > b) throw new B.Ja(28);
						return b;
					},
					ub(a, b, c) {
						bd(a.node, b + c);
						a.node.Pa = Math.max(a.node.Pa, b + c);
					},
					qb(a, b, c, d, e) {
						if (!B.isFile(a.node.mode)) throw new B.Ja(43);
						a = a.node.La;
						if (e & 2 || !a || a.buffer !== f().buffer) {
							d = !0;
							D();
							e = void 0;
							if (!e) throw new B.Ja(48);
							if (a) {
								if (0 < c || c + b < a.length)
									a.subarray
										? (a = a.subarray(c, c + b))
										: (a = Array.prototype.slice.call(a, c, c + b));
								f().set(a, e);
							}
						} else (d = !1), (e = a.byteOffset);
						return { Ta: e, Tc: d };
					},
					xb(a, b, c, d) {
						T.Ma.write(a, b, 0, d, c, !1);
						return 0;
					},
				},
			},
			cd = (a, b, c) => {
				var d = `al ${a}`;
				pa(a).then(
					(e) => {
						b(new Uint8Array(e));
						d && Na();
					},
					() => {
						if (c) c();
						else throw `Loading data file "${a}" failed.`;
					},
				);
				d && C++;
			},
			dd = [],
			ed = (a, b, c, d) => {
				"undefined" != typeof Browser && Browser.vb();
				var e = !1;
				dd.forEach((g) => {
					!e && g.canHandle(b) && (g.handle(a, b, c, d), (e = !0));
				});
				return e;
			},
			fd = (a, b) => {
				var c = 0;
				a && (c |= 365);
				b && (c |= 146);
				return c;
			},
			W = {
				Cb: 16895,
				tb: 33279,
				Rb: null,
				Oa(a) {
					function b(g) {
						g = g.split("/");
						for (var h = d, k = 0; k < g.length - 1; k++) {
							var m = g.slice(0, k + 1).join("/");
							let l, n;
							(l = e)[(n = m)] || (l[n] = W.createNode(h, g[k], W.Cb, 0));
							h = e[m];
						}
						return h;
					}
					function c(g) {
						g = g.split("/");
						return g[g.length - 1];
					}
					W.Rb ?? (W.Rb = new FileReaderSync());
					var d = W.createNode(null, "/", W.Cb, 0),
						e = {};
					Array.prototype.forEach.call(a.zb.files || [], (g) => {
						W.createNode(b(g.name), c(g.name), W.tb, 0, g, g.lastModifiedDate);
					});
					(a.zb.blobs || []).forEach((g) => {
						W.createNode(b(g.name), c(g.name), W.tb, 0, g.data);
					});
					(a.zb.packages || []).forEach((g) => {
						g.metadata.files.forEach((h) => {
							var k = h.filename.substr(1);
							W.createNode(b(k), c(k), W.tb, 0, g.blob.slice(h.start, h.end));
						});
					});
					return d;
				},
				createNode(a, b, c, d, e, g) {
					d = B.createNode(a, b, c);
					d.mode = c;
					d.Ka = W.Ka;
					d.Ma = W.Ma;
					d.timestamp = (g || new Date()).getTime();
					W.tb !== W.Cb || D();
					c === W.tb
						? ((d.size = e.size), (d.La = e))
						: ((d.size = 4096), (d.La = {}));
					a && (a.La[b] = d);
					return d;
				},
				Ka: {
					Xa(a) {
						return {
							cc: 1,
							Lb: a.id,
							mode: a.mode,
							nc: 1,
							uid: 0,
							ic: 0,
							rb: 0,
							size: a.size,
							Yb: new Date(a.timestamp),
							mc: new Date(a.timestamp),
							ac: new Date(a.timestamp),
							Zb: 4096,
							Fb: Math.ceil(a.size / 4096),
						};
					},
					Qa(a, b) {
						void 0 !== b.mode && (a.mode = b.mode);
						void 0 !== b.timestamp && (a.timestamp = b.timestamp);
					},
					ib() {
						throw new B.Ja(44);
					},
					Za() {
						throw new B.Ja(63);
					},
					nb() {
						throw new B.Ja(63);
					},
					pb() {
						throw new B.Ja(63);
					},
					ob() {
						throw new B.Ja(63);
					},
					sb(a) {
						var b = [".", ".."],
							c;
						for (c of Object.keys(a.La)) b.push(c);
						return b;
					},
					hb() {
						throw new B.Ja(63);
					},
				},
				Ma: {
					read(a, b, c, d, e) {
						if (e >= a.node.size) return 0;
						a = a.node.La.slice(e, e + d);
						d = W.Rb.readAsArrayBuffer(a);
						b.set(new Uint8Array(d), c);
						return a.size;
					},
					write() {
						throw new B.Ja(29);
					},
					Ua(a, b, c) {
						1 === c
							? (b += a.position)
							: 2 === c && B.isFile(a.node.mode) && (b += a.node.size);
						if (0 > b) throw new B.Ja(28);
						return b;
					},
				},
			};
		function Yc(a, b) {
			B.dc[a] = { Ma: b };
		}
		function U(a) {
			return 16384 === (a & 61440);
		}
		function V(a, b) {
			var c = U(a.mode) ? ((c = gd(a, "x")) ? c : a.Ka.ib ? 0 : 2) : 54;
			if (c) throw new B.Ja(c);
			for (c = B.$a[hd(a.id, b)]; c; c = c.lb) {
				var d = c.name;
				if (c.parent.id === a.id && d === b) return c;
			}
			return B.ib(a, b);
		}
		function X(a, b = {}) {
			a = Pc(a);
			if (!a) return { path: "", node: null };
			b = Object.assign({ Hb: !0, Sb: 0 }, b);
			if (8 < b.Sb) throw new B.Ja(32);
			a = a.split("/").filter((h) => !!h);
			for (var c = B.root, d = "/", e = 0; e < a.length; e++) {
				var g = e === a.length - 1;
				if (g && b.parent) break;
				c = V(c, a[e]);
				d = S(d + "/" + a[e]);
				c.Ya && (!g || (g && b.Hb)) && (c = c.Ya.root);
				if (!g || b.Wa)
					for (g = 0; 40960 === (c.mode & 61440); )
						if (
							((c = B.mb(d)),
							(d = Pc(Kc(d), c)),
							(c = X(d, { Sb: b.Sb + 1 }).node),
							40 < g++)
						)
							throw new B.Ja(32);
			}
			return { path: d, node: c };
		}
		function jd(a) {
			for (var b; ; ) {
				if (B.jc(a))
					return (
						(a = a.Oa.lc),
						b ? ("/" !== a[a.length - 1] ? `${a}/${b}` : a + b) : a
					);
				b = b ? `${a.name}/${b}` : a.name;
				a = a.parent;
			}
		}
		function hd(a, b) {
			for (var c = 0, d = 0; d < b.length; d++)
				c = ((c << 5) - c + b.charCodeAt(d)) | 0;
			return ((a + c) >>> 0) % B.$a.length;
		}
		function kd(a) {
			var b = hd(a.parent.id, a.name);
			a.lb = B.$a[b];
			B.$a[b] = a;
		}
		function ld(a) {
			var b = hd(a.parent.id, a.name);
			if (B.$a[b] === a) B.$a[b] = a.lb;
			else
				for (b = B.$a[b]; b; ) {
					if (b.lb === a) {
						b.lb = a.lb;
						break;
					}
					b = b.lb;
				}
		}
		function md(a) {
			var b = ["r", "w", "rw"][a & 3];
			a & 512 && (b += "w");
			return b;
		}
		function gd(a, b) {
			if (B.Jb) return 0;
			if (!b.includes("r") || a.mode & 292) {
				if (
					(b.includes("w") && !(a.mode & 146)) ||
					(b.includes("x") && !(a.mode & 73))
				)
					return 2;
			} else return 2;
			return 0;
		}
		function nd(a, b) {
			try {
				return V(a, b), 20;
			} catch (c) {}
			return gd(a, "wx");
		}
		function od(a, b, c) {
			try {
				var d = V(a, b);
			} catch (e) {
				return e.Ra;
			}
			if ((a = gd(a, "wx"))) return a;
			if (c) {
				if (!U(d.mode)) return 54;
				if (B.jc(d) || jd(d) === B.Gb()) return 10;
			} else if (U(d.mode)) return 31;
			return 0;
		}
		function Y(a) {
			a = B.Cc(a);
			if (!a) throw new B.Ja(8);
			return a;
		}
		function pd(a, b = -1) {
			a = Object.assign(new B.rc(), a);
			if (-1 == b)
				a: {
					for (b = 0; b <= B.sc; b++) if (!B.streams[b]) break a;
					throw new B.Ja(33);
				}
			a.eb = b;
			return (B.streams[b] = a);
		}
		function qd(a, b = -1) {
			a = pd(a, b);
			a.Ma?.dd?.(a);
			return a;
		}
		function rd(a) {
			var b = [];
			for (a = [a]; a.length; ) {
				var c = a.pop();
				b.push(c);
				a.push(...c.wb);
			}
			return b;
		}
		function sd(a, b, c) {
			"undefined" == typeof c && ((c = b), (b = 438));
			return B.Za(a, b | 8192, c);
		}
		function td(a, b, c) {
			a = "string" == typeof a ? X(a, { Wa: !c }).node : a;
			if (!a.Ka.Qa) throw new B.Ja(63);
			a.Ka.Qa(a, {
				mode: (b & 4095) | (a.mode & -4096),
				timestamp: Date.now(),
			});
		}
		function ud(a, b) {
			a = "string" == typeof a ? X(a, { Wa: !b }).node : a;
			if (!a.Ka.Qa) throw new B.Ja(63);
			a.Ka.Qa(a, { timestamp: Date.now() });
		}
		function vd(a, b, c, d) {
			a = "string" == typeof a ? a : jd(a);
			b = S(a + "/" + b);
			return B.create(b, fd(c, d));
		}
		function wd(a) {
			if (!(a.Nb || a.Ic || a.link || a.La)) {
				if ("undefined" != typeof XMLHttpRequest)
					throw Error(
						"Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.",
					);
				try {
					(a.La = qa(a.url)), (a.Pa = a.La.length);
				} catch (b) {
					throw new B.Ja(29);
				}
			}
		}
		var B = {
				root: null,
				wb: [],
				dc: {},
				streams: [],
				Pb: 1,
				$a: null,
				bc: "/",
				Kb: !1,
				Jb: !0,
				Ja: class {
					name = "ErrnoError";
					constructor(a) {
						this.Ra = a;
					}
				},
				Ac: null,
				Ab: 0,
				rc: class {
					bb = {};
					node = null;
					get object() {
						return this.node;
					}
					set object(a) {
						this.node = a;
					}
					get flags() {
						return this.bb.flags;
					}
					set flags(a) {
						this.bb.flags = a;
					}
					get position() {
						return this.bb.position;
					}
					set position(a) {
						this.bb.position = a;
					}
				},
				qc: class {
					Ka = {};
					Ma = {};
					Ya = null;
					constructor(a, b, c, d) {
						a ||= this;
						this.parent = a;
						this.Oa = a.Oa;
						this.id = B.Pb++;
						this.name = b;
						this.mode = c;
						this.rb = d;
					}
					get read() {
						return 365 === (this.mode & 365);
					}
					set read(a) {
						a ? (this.mode |= 365) : (this.mode &= -366);
					}
					get write() {
						return 146 === (this.mode & 146);
					}
					set write(a) {
						a ? (this.mode |= 146) : (this.mode &= -147);
					}
					get Ic() {
						return U(this.mode);
					}
					get Nb() {
						return 8192 === (this.mode & 61440);
					}
				},
				createNode(a, b, c, d) {
					a = new B.qc(a, b, c, d);
					kd(a);
					return a;
				},
				jc(a) {
					return a === a.parent;
				},
				isFile(a) {
					return 32768 === (a & 61440);
				},
				nd(a) {
					return 49152 === (a & 49152);
				},
				sc: 4096,
				Cc: (a) => B.streams[a],
				xc: {
					open(a) {
						a.Ma = B.Bc(a.node.rb).Ma;
						a.Ma.open?.(a);
					},
					Ua() {
						throw new B.Ja(70);
					},
				},
				Ob: (a) => a >> 8,
				qd: (a) => a & 255,
				kb: (a, b) => (a << 8) | b,
				Bc: (a) => B.dc[a],
				pc(a, b) {
					function c(h) {
						B.Ab--;
						return b(h);
					}
					function d(h) {
						if (h) {
							if (!d.zc) return (d.zc = !0), c(h);
						} else ++g >= e.length && c(null);
					}
					"function" == typeof a && ((b = a), (a = !1));
					B.Ab++;
					1 < B.Ab &&
						A(
							`warning: ${B.Ab} FS.syncfs operations in flight at once, probably just doing extra work`,
						);
					var e = rd(B.root.Oa),
						g = 0;
					e.forEach((h) => {
						if (!h.type.pc) return d(null);
						h.type.pc(h, a, d);
					});
				},
				Oa(a, b, c) {
					var d = "/" === c;
					if (d && B.root) throw new B.Ja(10);
					if (!d && c) {
						var e = X(c, { Hb: !1 });
						c = e.path;
						e = e.node;
						if (e.Ya) throw new B.Ja(10);
						if (!U(e.mode)) throw new B.Ja(54);
					}
					b = { type: a, zb: b, lc: c, wb: [] };
					a = a.Oa(b);
					a.Oa = b;
					b.root = a;
					d ? (B.root = a) : e && ((e.Ya = b), e.Oa && e.Oa.wb.push(b));
					return a;
				},
				wd(a) {
					a = X(a, { Hb: !1 });
					if (!a.node.Ya) throw new B.Ja(28);
					a = a.node;
					var b = a.Ya,
						c = rd(b);
					Object.keys(B.$a).forEach((d) => {
						for (d = B.$a[d]; d; ) {
							var e = d.lb;
							c.includes(d.Oa) && ld(d);
							d = e;
						}
					});
					a.Ya = null;
					a.Oa.wb.splice(a.Oa.wb.indexOf(b), 1);
				},
				ib(a, b) {
					return a.Ka.ib(a, b);
				},
				Za(a, b, c) {
					var d = X(a, { parent: !0 }).node;
					a = Lc(a);
					if (!a || "." === a || ".." === a) throw new B.Ja(28);
					var e = nd(d, a);
					if (e) throw new B.Ja(e);
					if (!d.Ka.Za) throw new B.Ja(63);
					return d.Ka.Za(d, a, b, c);
				},
				oc(a) {
					var b = {
						Wc: 4096,
						jd: 4096,
						Fb: 1e6,
						Vc: 5e5,
						Uc: 5e5,
						files: B.Pb,
						gd: B.Pb - 1,
						kd: 42,
						flags: 2,
						sd: 255,
					};
					a = X(a, { Wa: !0 }).node;
					a?.Ka.oc && Object.assign(b, a.Ka.oc(a.Oa.zb.root));
					return b;
				},
				create(a, b = 438) {
					return B.Za(a, (b & 4095) | 32768, 0);
				},
				Va(a, b = 511) {
					return B.Za(a, (b & 1023) | 16384, 0);
				},
				rd(a, b) {
					a = a.split("/");
					for (var c = "", d = 0; d < a.length; ++d)
						if (a[d]) {
							c += "/" + a[d];
							try {
								B.Va(c, b);
							} catch (e) {
								if (20 != e.Ra) throw e;
							}
						}
				},
				hb(a, b) {
					if (!Pc(a)) throw new B.Ja(44);
					var c = X(b, { parent: !0 }).node;
					if (!c) throw new B.Ja(44);
					b = Lc(b);
					var d = nd(c, b);
					if (d) throw new B.Ja(d);
					if (!c.Ka.hb) throw new B.Ja(63);
					return c.Ka.hb(c, b, a);
				},
				nb(a, b) {
					var c = Kc(a),
						d = Kc(b),
						e = Lc(a),
						g = Lc(b);
					var h = X(a, { parent: !0 });
					var k = h.node;
					h = X(b, { parent: !0 });
					h = h.node;
					if (!k || !h) throw new B.Ja(44);
					if (k.Oa !== h.Oa) throw new B.Ja(75);
					var m = V(k, e);
					a = Qc(a, d);
					if ("." !== a.charAt(0)) throw new B.Ja(28);
					a = Qc(b, c);
					if ("." !== a.charAt(0)) throw new B.Ja(55);
					try {
						var l = V(h, g);
					} catch (n) {}
					if (m !== l) {
						b = U(m.mode);
						if ((e = od(k, e, b))) throw new B.Ja(e);
						if ((e = l ? od(h, g, b) : nd(h, g))) throw new B.Ja(e);
						if (!k.Ka.nb) throw new B.Ja(63);
						if (m.Ya || (l && l.Ya)) throw new B.Ja(10);
						if (h !== k && (e = gd(k, "w"))) throw new B.Ja(e);
						ld(m);
						try {
							k.Ka.nb(m, h, g), (m.parent = h);
						} catch (n) {
							throw n;
						} finally {
							kd(m);
						}
					}
				},
				ob(a) {
					var b = X(a, { parent: !0 }).node;
					a = Lc(a);
					var c = V(b, a),
						d = od(b, a, !0);
					if (d) throw new B.Ja(d);
					if (!b.Ka.ob) throw new B.Ja(63);
					if (c.Ya) throw new B.Ja(10);
					b.Ka.ob(b, a);
					ld(c);
				},
				sb(a) {
					a = X(a, { Wa: !0 }).node;
					if (!a.Ka.sb) throw new B.Ja(54);
					return a.Ka.sb(a);
				},
				pb(a) {
					var b = X(a, { parent: !0 }).node;
					if (!b) throw new B.Ja(44);
					a = Lc(a);
					var c = V(b, a),
						d = od(b, a, !1);
					if (d) throw new B.Ja(d);
					if (!b.Ka.pb) throw new B.Ja(63);
					if (c.Ya) throw new B.Ja(10);
					b.Ka.pb(b, a);
					ld(c);
				},
				mb(a) {
					a = X(a).node;
					if (!a) throw new B.Ja(44);
					if (!a.Ka.mb) throw new B.Ja(28);
					return a.Ka.mb(a);
				},
				stat(a, b) {
					a = X(a, { Wa: !b }).node;
					if (!a) throw new B.Ja(44);
					if (!a.Ka.Xa) throw new B.Ja(63);
					return a.Ka.Xa(a);
				},
				kc(a) {
					return B.stat(a, !0);
				},
				od(a, b) {
					td(a, b, !0);
				},
				ed(a, b) {
					a = Y(a);
					td(a.node, b);
				},
				pd(a) {
					ud(a, !0);
				},
				fd(a) {
					a = Y(a);
					ud(a.node);
				},
				truncate(a, b) {
					if (0 > b) throw new B.Ja(28);
					a = "string" == typeof a ? X(a, { Wa: !0 }).node : a;
					if (!a.Ka.Qa) throw new B.Ja(63);
					if (U(a.mode)) throw new B.Ja(31);
					if (!B.isFile(a.mode)) throw new B.Ja(28);
					var c = gd(a, "w");
					if (c) throw new B.Ja(c);
					a.Ka.Qa(a, { size: b, timestamp: Date.now() });
				},
				ld(a, b) {
					a = Y(a);
					if (0 === (a.flags & 2097155)) throw new B.Ja(28);
					B.truncate(a.node, b);
				},
				xd(a, b, c) {
					a = X(a, { Wa: !0 }).node;
					a.Ka.Qa(a, { timestamp: Math.max(b, c) });
				},
				open(a, b, c = 438) {
					if ("" === a) throw new B.Ja(44);
					if ("string" == typeof b) {
						var d = { r: 0, "r+": 2, w: 577, "w+": 578, a: 1089, "a+": 1090 }[
							b
						];
						if ("undefined" == typeof d)
							throw Error(`Unknown file open mode: ${b}`);
						b = d;
					}
					c = b & 64 ? (c & 4095) | 32768 : 0;
					if ("object" == typeof a) var e = a;
					else {
						a = S(a);
						try {
							e = X(a, { Wa: !(b & 131072) }).node;
						} catch (g) {}
					}
					d = !1;
					if (b & 64)
						if (e) {
							if (b & 128) throw new B.Ja(20);
						} else (e = B.Za(a, c, 0)), (d = !0);
					if (!e) throw new B.Ja(44);
					8192 === (e.mode & 61440) && (b &= -513);
					if (b & 65536 && !U(e.mode)) throw new B.Ja(54);
					if (
						!d &&
						(a = e
							? 40960 === (e.mode & 61440)
								? 32
								: U(e.mode) && ("r" !== md(b) || b & 512)
									? 31
									: gd(e, md(b))
							: 44)
					)
						throw new B.Ja(a);
					b & 512 && !d && B.truncate(e, 0);
					b &= -131713;
					e = pd({
						node: e,
						path: jd(e),
						flags: b,
						seekable: !0,
						position: 0,
						Ma: e.Ma,
						Oc: [],
						error: !1,
					});
					e.Ma.open && e.Ma.open(e);
					return e;
				},
				close(a) {
					if (null === a.eb) throw new B.Ja(8);
					a.Ib && (a.Ib = null);
					try {
						a.Ma.close && a.Ma.close(a);
					} catch (b) {
						throw b;
					} finally {
						B.streams[a.eb] = null;
					}
					a.eb = null;
				},
				Ua(a, b, c) {
					if (null === a.eb) throw new B.Ja(8);
					if (!a.seekable || !a.Ma.Ua) throw new B.Ja(70);
					if (0 != c && 1 != c && 2 != c) throw new B.Ja(28);
					a.position = a.Ma.Ua(a, b, c);
					a.Oc = [];
					return a.position;
				},
				read(a, b, c, d, e) {
					if (0 > d || 0 > e) throw new B.Ja(28);
					if (null === a.eb) throw new B.Ja(8);
					if (1 === (a.flags & 2097155)) throw new B.Ja(8);
					if (U(a.node.mode)) throw new B.Ja(31);
					if (!a.Ma.read) throw new B.Ja(28);
					var g = "undefined" != typeof e;
					if (!g) e = a.position;
					else if (!a.seekable) throw new B.Ja(70);
					b = a.Ma.read(a, b, c, d, e);
					g || (a.position += b);
					return b;
				},
				write(a, b, c, d, e, g) {
					if (0 > d || 0 > e) throw new B.Ja(28);
					if (null === a.eb) throw new B.Ja(8);
					if (0 === (a.flags & 2097155)) throw new B.Ja(8);
					if (U(a.node.mode)) throw new B.Ja(31);
					if (!a.Ma.write) throw new B.Ja(28);
					a.seekable && a.flags & 1024 && B.Ua(a, 0, 2);
					var h = "undefined" != typeof e;
					if (!h) e = a.position;
					else if (!a.seekable) throw new B.Ja(70);
					b = a.Ma.write(a, b, c, d, e, g);
					h || (a.position += b);
					return b;
				},
				ub(a, b, c) {
					if (null === a.eb) throw new B.Ja(8);
					if (0 > b || 0 >= c) throw new B.Ja(28);
					if (0 === (a.flags & 2097155)) throw new B.Ja(8);
					if (!B.isFile(a.node.mode) && !U(a.node.mode)) throw new B.Ja(43);
					if (!a.Ma.ub) throw new B.Ja(138);
					a.Ma.ub(a, b, c);
				},
				qb(a, b, c, d, e) {
					if (0 !== (d & 2) && 0 === (e & 2) && 2 !== (a.flags & 2097155))
						throw new B.Ja(2);
					if (1 === (a.flags & 2097155)) throw new B.Ja(2);
					if (!a.Ma.qb) throw new B.Ja(43);
					if (!b) throw new B.Ja(28);
					return a.Ma.qb(a, b, c, d, e);
				},
				xb(a, b, c, d, e) {
					return a.Ma.xb ? a.Ma.xb(a, b, c, d, e) : 0;
				},
				Mb(a, b, c) {
					if (!a.Ma.Mb) throw new B.Ja(59);
					return a.Ma.Mb(a, b, c);
				},
				Jc(a, b = {}) {
					b.flags = b.flags || 0;
					b.encoding = b.encoding || "binary";
					if ("utf8" !== b.encoding && "binary" !== b.encoding)
						throw Error(`Invalid encoding type "${b.encoding}"`);
					var c,
						d = B.open(a, b.flags);
					a = B.stat(a).size;
					var e = new Uint8Array(a);
					B.read(d, e, 0, a, 0);
					"utf8" === b.encoding
						? (c = Sc(e))
						: "binary" === b.encoding && (c = e);
					B.close(d);
					return c;
				},
				Sc(a, b, c = {}) {
					c.flags = c.flags || 577;
					a = B.open(a, c.flags, c.mode);
					if ("string" == typeof b) {
						var d = new Uint8Array(Uc(b) + 1);
						b = Vc(b, d, 0, d.length);
						B.write(a, d, 0, b, void 0, c.vc);
					} else if (ArrayBuffer.isView(b))
						B.write(a, b, 0, b.byteLength, void 0, c.vc);
					else throw Error("Unsupported data type");
					B.close(a);
				},
				Gb: () => B.bc,
				wc(a) {
					a = X(a, { Wa: !0 });
					if (null === a.node) throw new B.Ja(44);
					if (!U(a.node.mode)) throw new B.Ja(54);
					var b = gd(a.node, "x");
					if (b) throw new B.Ja(b);
					B.bc = a.path;
				},
				vb(a, b, c) {
					B.Kb = !0;
					a ? B.jb("/dev", "stdin", a) : B.hb("/dev/tty", "/dev/stdin");
					b ? B.jb("/dev", "stdout", null, b) : B.hb("/dev/tty", "/dev/stdout");
					c
						? B.jb("/dev", "stderr", null, c)
						: B.hb("/dev/tty1", "/dev/stderr");
					B.open("/dev/stdin", 0);
					B.open("/dev/stdout", 1);
					B.open("/dev/stderr", 1);
				},
				td() {
					B.Kb = !1;
					for (var a = 0; a < B.streams.length; a++) {
						var b = B.streams[a];
						b && B.close(b);
					}
				},
				hd(a, b) {
					try {
						var c = X(a, { Wa: !b });
						a = c.path;
					} catch (g) {}
					var d = !1,
						e = null;
					try {
						(c = X(a, { parent: !0 })),
							Lc(a),
							(c = X(a, { Wa: !b })),
							(d = !0),
							(e = c.node);
					} catch (g) {}
					return d ? e : null;
				},
				bd(a, b) {
					a = "string" == typeof a ? a : jd(a);
					for (b = b.split("/").reverse(); b.length; ) {
						var c = b.pop();
						if (c) {
							var d = S(a + "/" + c);
							try {
								B.Va(d);
							} catch (e) {}
							a = d;
						}
					}
					return d;
				},
				jb(a, b, c, d) {
					a = Mc("string" == typeof a ? a : jd(a), b);
					b = fd(!!c, !!d);
					var e;
					(e = B.jb).Ob ?? (e.Ob = 64);
					e = B.kb(B.jb.Ob++, 0);
					Yc(e, {
						open(g) {
							g.seekable = !1;
						},
						close() {
							d?.buffer?.length && d(10);
						},
						read(g, h, k, m) {
							for (var l = 0, n = 0; n < m; n++) {
								try {
									var v = c();
								} catch (I) {
									throw new B.Ja(29);
								}
								if (void 0 === v && 0 === l) throw new B.Ja(6);
								if (null === v || void 0 === v) break;
								l++;
								h[k + n] = v;
							}
							l && (g.node.timestamp = Date.now());
							return l;
						},
						write(g, h, k, m) {
							for (var l = 0; l < m; l++)
								try {
									d(h[k + l]);
								} catch (n) {
									throw new B.Ja(29);
								}
							m && (g.node.timestamp = Date.now());
							return l;
						},
					});
					return sd(a, b, e);
				},
				yc(a, b, c, d, e) {
					class g {
						Eb = !1;
						bb = [];
						Db = void 0;
						Ub = 0;
						Tb = 0;
						get(l) {
							if (!(l > this.length - 1 || 0 > l)) {
								var n = l % this.Wb;
								return this.Db((l / this.Wb) | 0)[n];
							}
						}
						tc(l) {
							this.Db = l;
						}
						Vb() {
							var l = new XMLHttpRequest();
							l.open("HEAD", c, !1);
							l.send(null);
							if (!((200 <= l.status && 300 > l.status) || 304 === l.status))
								throw Error("Couldn't load " + c + ". Status: " + l.status);
							var n = Number(l.getResponseHeader("Content-length")),
								v,
								I = (v = l.getResponseHeader("Accept-Ranges")) && "bytes" === v;
							l = (v = l.getResponseHeader("Content-Encoding")) && "gzip" === v;
							var E = 1048576;
							I || (E = n);
							this.tc((H) => {
								var L = H * E,
									F = (H + 1) * E - 1;
								F = Math.min(F, n - 1);
								if ("undefined" == typeof this.bb[H]) {
									var ma = this.bb;
									if (L > F)
										throw Error(
											"invalid range (" +
												L +
												", " +
												F +
												") or no bytes requested!",
										);
									if (F > n - 1)
										throw Error(
											"only " + n + " bytes available! programmer error!",
										);
									var P = new XMLHttpRequest();
									P.open("GET", c, !1);
									n !== E &&
										P.setRequestHeader("Range", "bytes=" + L + "-" + F);
									P.responseType = "arraybuffer";
									P.overrideMimeType &&
										P.overrideMimeType("text/plain; charset=x-user-defined");
									P.send(null);
									if (
										!((200 <= P.status && 300 > P.status) || 304 === P.status)
									)
										throw Error("Couldn't load " + c + ". Status: " + P.status);
									void 0 !== P.response
										? (L = new Uint8Array(P.response || []))
										: ((F = P.responseText || ""),
											(L = Array(Uc(F) + 1)),
											(F = Vc(F, L, 0, L.length)),
											(L.length = F));
									ma[H] = L;
								}
								if ("undefined" == typeof this.bb[H])
									throw Error("doXHR failed!");
								return this.bb[H];
							});
							if (l || !n)
								(E = n = 1),
									(E = n = this.Db(0).length),
									ra(
										"LazyFiles on gzip forces download of the whole file when length is accessed",
									);
							this.Ub = n;
							this.Tb = E;
							this.Eb = !0;
						}
						get length() {
							this.Eb || this.Vb();
							return this.Ub;
						}
						get Wb() {
							this.Eb || this.Vb();
							return this.Tb;
						}
					}
					var h =
							"undefined" != typeof XMLHttpRequest
								? { Nb: !1, La: new g() }
								: { Nb: !1, url: c },
						k = vd(a, b, d, e);
					h.La ? (k.La = h.La) : h.url && ((k.La = null), (k.url = h.url));
					Object.defineProperties(k, {
						Pa: {
							get: function () {
								return this.La.length;
							},
						},
					});
					var m = {};
					Object.keys(k.Ma).forEach((l) => {
						var n = k.Ma[l];
						m[l] = (...v) => {
							wd(k);
							return n(...v);
						};
					});
					m.read = (l, n, v, I, E) => {
						wd(k);
						l = l.node.La;
						if (E >= l.length) n = 0;
						else {
							I = Math.min(l.length - E, I);
							if (l.slice) for (var x = 0; x < I; x++) n[v + x] = l[E + x];
							else for (x = 0; x < I; x++) n[v + x] = l.get(E + x);
							n = I;
						}
						return n;
					};
					m.qb = () => {
						wd(k);
						D();
						throw new B.Ja(48);
					};
					k.Ma = m;
					return k;
				},
			},
			xd = (a) => (a ? Sc(aa(), a) : "");
		function yd(a, b, c) {
			if ("/" === b.charAt(0)) return b;
			a = -100 === a ? B.Gb() : Y(a).path;
			if (0 == b.length) {
				if (!c) throw new B.Ja(44);
				return a;
			}
			return S(a + "/" + b);
		}
		function zd(a, b, c) {
			a = a(b);
			t()[c >> 2] = a.cc;
			t()[(c + 4) >> 2] = a.mode;
			u()[(c + 8) >> 2] = a.nc;
			t()[(c + 12) >> 2] = a.uid;
			t()[(c + 16) >> 2] = a.ic;
			t()[(c + 20) >> 2] = a.rb;
			J = [
				a.size >>> 0,
				((G = a.size),
				1 <= +Math.abs(G)
					? 0 < G
						? +Math.floor(G / 4294967296) >>> 0
						: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
					: 0),
			];
			t()[(c + 24) >> 2] = J[0];
			t()[(c + 28) >> 2] = J[1];
			t()[(c + 32) >> 2] = 4096;
			t()[(c + 36) >> 2] = a.Fb;
			b = a.Yb.getTime();
			var d = a.mc.getTime(),
				e = a.ac.getTime();
			J = [
				Math.floor(b / 1e3) >>> 0,
				((G = Math.floor(b / 1e3)),
				1 <= +Math.abs(G)
					? 0 < G
						? +Math.floor(G / 4294967296) >>> 0
						: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
					: 0),
			];
			t()[(c + 40) >> 2] = J[0];
			t()[(c + 44) >> 2] = J[1];
			u()[(c + 48) >> 2] = (b % 1e3) * 1e6;
			J = [
				Math.floor(d / 1e3) >>> 0,
				((G = Math.floor(d / 1e3)),
				1 <= +Math.abs(G)
					? 0 < G
						? +Math.floor(G / 4294967296) >>> 0
						: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
					: 0),
			];
			t()[(c + 56) >> 2] = J[0];
			t()[(c + 60) >> 2] = J[1];
			u()[(c + 64) >> 2] = (d % 1e3) * 1e6;
			J = [
				Math.floor(e / 1e3) >>> 0,
				((G = Math.floor(e / 1e3)),
				1 <= +Math.abs(G)
					? 0 < G
						? +Math.floor(G / 4294967296) >>> 0
						: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
					: 0),
			];
			t()[(c + 72) >> 2] = J[0];
			t()[(c + 76) >> 2] = J[1];
			u()[(c + 80) >> 2] = (e % 1e3) * 1e6;
			J = [
				a.Lb >>> 0,
				((G = a.Lb),
				1 <= +Math.abs(G)
					? 0 < G
						? +Math.floor(G / 4294967296) >>> 0
						: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
					: 0),
			];
			t()[(c + 88) >> 2] = J[0];
			t()[(c + 92) >> 2] = J[1];
			return 0;
		}
		var Ic = void 0;
		function db(a, b, c) {
			if (y) return N(2, 1, a, b, c);
			Ic = c;
			try {
				var d = Y(a);
				switch (b) {
					case 0: {
						var e = R();
						if (0 > e) break;
						for (; B.streams[e]; ) e++;
						return qd(d, e).eb;
					}
					case 1:
					case 2:
						return 0;
					case 3:
						return d.flags;
					case 4:
						return (e = R()), (d.flags |= e), 0;
					case 12:
						return (e = R()), (ca()[(e + 0) >> 1] = 2), 0;
					case 13:
					case 14:
						return 0;
				}
				return -28;
			} catch (g) {
				if ("undefined" == typeof B || "ErrnoError" !== g.name) throw g;
				return -g.Ra;
			}
		}
		function eb(a, b, c) {
			if (y) return N(4, 1, a, b, c);
			Ic = c;
			try {
				var d = Y(a);
				switch (b) {
					case 21509:
						return d.Na ? 0 : -59;
					case 21505:
						if (!d.Na) return -59;
						if (d.Na.fb.Fc) {
							a = [
								3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0,
								0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
							];
							var e = R();
							t()[e >> 2] = 25856;
							t()[(e + 4) >> 2] = 5;
							t()[(e + 8) >> 2] = 191;
							t()[(e + 12) >> 2] = 35387;
							for (var g = 0; 32 > g; g++) f()[e + g + 17] = a[g] || 0;
						}
						return 0;
					case 21510:
					case 21511:
					case 21512:
						return d.Na ? 0 : -59;
					case 21506:
					case 21507:
					case 21508:
						if (!d.Na) return -59;
						if (d.Na.fb.Gc)
							for (e = R(), t(), t(), t(), t(), a = [], g = 0; 32 > g; g++)
								a.push(f()[e + g + 17]);
						return 0;
					case 21519:
						if (!d.Na) return -59;
						e = R();
						return (t()[e >> 2] = 0);
					case 21520:
						return d.Na ? -28 : -59;
					case 21531:
						return (e = R()), B.Mb(d, b, e);
					case 21523:
						if (!d.Na) return -59;
						d.Na.fb.Hc &&
							((g = [24, 80]),
							(e = R()),
							(ca()[e >> 1] = g[0]),
							(ca()[(e + 2) >> 1] = g[1]));
						return 0;
					case 21524:
						return d.Na ? 0 : -59;
					case 21515:
						return d.Na ? 0 : -59;
					default:
						return -28;
				}
			} catch (h) {
				if ("undefined" == typeof B || "ErrnoError" !== h.name) throw h;
				return -h.Ra;
			}
		}
		function fb(a, b, c, d) {
			if (y) return N(7, 1, a, b, c, d);
			Ic = d;
			try {
				b = xd(b);
				b = yd(a, b);
				var e = d ? R() : 0;
				return B.open(b, c, e).eb;
			} catch (g) {
				if ("undefined" == typeof B || "ErrnoError" !== g.name) throw g;
				return -g.Ra;
			}
		}
		function gb(a, b, c, d) {
			if (y) return N(8, 1, a, b, c, d);
			try {
				return (
					(b = xd(b)),
					(d = xd(d)),
					(b = yd(a, b)),
					(d = yd(c, d)),
					B.nb(b, d),
					0
				);
			} catch (e) {
				if ("undefined" == typeof B || "ErrnoError" !== e.name) throw e;
				return -e.Ra;
			}
		}
		function hb(a, b) {
			if (y) return N(9, 1, a, b);
			try {
				return (a = xd(a)), zd(B.stat, a, b);
			} catch (c) {
				if ("undefined" == typeof B || "ErrnoError" !== c.name) throw c;
				return -c.Ra;
			}
		}
		function ib(a, b, c) {
			if (y) return N(10, 1, a, b, c);
			try {
				return (
					(b = xd(b)),
					(b = yd(a, b)),
					0 === c
						? B.pb(b)
						: 512 === c
							? B.ob(b)
							: D("Invalid flags passed to unlinkat"),
					0
				);
			} catch (d) {
				if ("undefined" == typeof B || "ErrnoError" !== d.name) throw d;
				return -d.Ra;
			}
		}
		var jb = () => D(""),
			kb = (a) => {
				za(a, !1, 1, !0, 1048576, !1);
				Aa();
			},
			Ad = (a) => {
				if (!ta)
					try {
						if ((a(), !(jc || 0 < gc)))
							try {
								y ? xc(ua) : Bb(ua);
							} catch (b) {
								nc(b);
							}
					} catch (b) {
						nc(b);
					}
			},
			Ba = (a) => {
				"function" === typeof Atomics.Pc &&
					(Atomics.Pc(t(), a >> 2, a).value.then(Da),
					(a += 128),
					Atomics.store(t(), a >> 2, 1));
			},
			Da = () => {
				var a = xa();
				a && (Ba(a), Ad(Bd));
			},
			lb = (a, b) => {
				a == b
					? setTimeout(Da)
					: y
						? postMessage({ Bb: a, cb: "checkMailbox" })
						: (a = mc[a]) && a.postMessage({ cb: "checkMailbox" });
			},
			Cd = [],
			mb = (a, b, c, d, e) => {
				Cd.length = d;
				b = e >> 3;
				for (c = 0; c < d; c++) Cd[c] = ha()[b + c];
				return (0, Dd[a])(...Cd);
			},
			nb = () => {
				jc = !1;
				gc = 0;
			},
			ob = (a) => {
				y ? postMessage({ cb: "cleanupThread", Lc: a }) : uc(mc[a]);
			},
			pb = () => {},
			qb = () => {
				throw Infinity;
			},
			Ed = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335],
			Fd = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
		function rb(a, b, c) {
			a = new Date(
				1e3 *
					((b + 2097152) >>> 0 < 4194305 - !!a
						? (a >>> 0) + 4294967296 * b
						: NaN),
			);
			t()[c >> 2] = a.getSeconds();
			t()[(c + 4) >> 2] = a.getMinutes();
			t()[(c + 8) >> 2] = a.getHours();
			t()[(c + 12) >> 2] = a.getDate();
			t()[(c + 16) >> 2] = a.getMonth();
			t()[(c + 20) >> 2] = a.getFullYear() - 1900;
			t()[(c + 24) >> 2] = a.getDay();
			b = a.getFullYear();
			b =
				((0 !== b % 4 || (0 === b % 100 && 0 !== b % 400) ? Fd : Ed)[
					a.getMonth()
				] +
					a.getDate() -
					1) |
				0;
			t()[(c + 28) >> 2] = b;
			t()[(c + 36) >> 2] = -(60 * a.getTimezoneOffset());
			b = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
			var d = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
			a = (b != d && a.getTimezoneOffset() == Math.min(d, b)) | 0;
			t()[(c + 32) >> 2] = a;
		}
		var Gd = {},
			xb = () => performance.timeOrigin + performance.now();
		function sb(a, b) {
			if (y) return N(11, 1, a, b);
			Gd[a] && (clearTimeout(Gd[a].id), delete Gd[a]);
			if (!b) return 0;
			var c = setTimeout(() => {
				delete Gd[a];
				Ad(() => Hd(a, performance.timeOrigin + performance.now()));
			}, b);
			Gd[a] = { id: c, vd: b };
			return 0;
		}
		var Id = (a, b) => {
				Vc(a, aa(), b, 17);
			},
			tb = (a, b, c, d) => {
				var e = new Date().getFullYear(),
					g = new Date(e, 0, 1).getTimezoneOffset();
				e = new Date(e, 6, 1).getTimezoneOffset();
				var h = Math.max(g, e);
				u()[a >> 2] = 60 * h;
				t()[b >> 2] = Number(g != e);
				b = (k) => {
					var m = Math.abs(k);
					return `UTC${0 <= k ? "-" : "+"}${String(Math.floor(m / 60)).padStart(2, "0")}${String(m % 60).padStart(2, "0")}`;
				};
				a = b(g);
				b = b(e);
				e < g ? (Id(a, c), Id(b, d)) : (Id(a, d), Id(b, c));
			},
			ub = () => {},
			vb = () => Date.now(),
			wb = () => {
				gc += 1;
				throw "unwind";
			},
			yb = (a) => {
				var b = aa().length;
				a >>>= 0;
				if (a <= b || 2147483648 < a) return !1;
				for (var c = 1; 4 >= c; c *= 2) {
					var d = b * (1 + 0.2 / c);
					d = Math.min(d, a + 100663296);
					a: {
						d =
							((Math.min(
								2147483648,
								65536 * Math.ceil(Math.max(a, d) / 65536),
							) -
								p.buffer.byteLength +
								65535) /
								65536) |
							0;
						try {
							p.grow(d);
							r();
							var e = 1;
							break a;
						} catch (g) {}
						e = void 0;
					}
					if (e) return !0;
				}
				return !1;
			},
			Jd = {},
			Ld = () => {
				if (!Kd) {
					var a = {
							USER: "web_user",
							LOGNAME: "web_user",
							PATH: "/",
							PWD: "/",
							HOME: "/home/web_user",
							LANG:
								(
									("object" == typeof navigator &&
										navigator.languages &&
										navigator.languages[0]) ||
									"C"
								).replace("-", "_") + ".UTF-8",
							_: "./this.program",
						},
						b;
					for (b in Jd) void 0 === Jd[b] ? delete a[b] : (a[b] = Jd[b]);
					var c = [];
					for (b in a) c.push(`${b}=${a[b]}`);
					Kd = c;
				}
				return Kd;
			},
			Kd;
		function zb(a, b) {
			if (y) return N(12, 1, a, b);
			var c = 0;
			Ld().forEach((d, e) => {
				var g = b + c;
				e = u()[(a + 4 * e) >> 2] = g;
				for (g = 0; g < d.length; ++g) f()[e++] = d.charCodeAt(g);
				f()[e] = 0;
				c += d.length + 1;
			});
			return 0;
		}
		function Ab(a, b) {
			if (y) return N(13, 1, a, b);
			var c = Ld();
			u()[a >> 2] = c.length;
			var d = 0;
			c.forEach((e) => (d += e.length + 1));
			u()[b >> 2] = d;
			return 0;
		}
		function Cb(a) {
			if (y) return N(14, 1, a);
			try {
				var b = Y(a);
				B.close(b);
				return 0;
			} catch (c) {
				if ("undefined" == typeof B || "ErrnoError" !== c.name) throw c;
				return c.Ra;
			}
		}
		function Db(a, b, c, d) {
			if (y) return N(15, 1, a, b, c, d);
			try {
				a: {
					var e = Y(a);
					a = b;
					for (var g, h = (b = 0); h < c; h++) {
						var k = u()[a >> 2],
							m = u()[(a + 4) >> 2];
						a += 8;
						var l = B.read(e, f(), k, m, g);
						if (0 > l) {
							var n = -1;
							break a;
						}
						b += l;
						if (l < m) break;
						"undefined" != typeof g && (g += l);
					}
					n = b;
				}
				u()[d >> 2] = n;
				return 0;
			} catch (v) {
				if ("undefined" == typeof B || "ErrnoError" !== v.name) throw v;
				return v.Ra;
			}
		}
		function Eb(a, b, c, d, e) {
			if (y) return N(16, 1, a, b, c, d, e);
			b =
				(c + 2097152) >>> 0 < 4194305 - !!b ? (b >>> 0) + 4294967296 * c : NaN;
			try {
				if (isNaN(b)) return 61;
				var g = Y(a);
				B.Ua(g, b, d);
				J = [
					g.position >>> 0,
					((G = g.position),
					1 <= +Math.abs(G)
						? 0 < G
							? +Math.floor(G / 4294967296) >>> 0
							: ~~+Math.ceil((G - +(~~G >>> 0)) / 4294967296) >>> 0
						: 0),
				];
				t()[e >> 2] = J[0];
				t()[(e + 4) >> 2] = J[1];
				g.Ib && 0 === b && 0 === d && (g.Ib = null);
				return 0;
			} catch (h) {
				if ("undefined" == typeof B || "ErrnoError" !== h.name) throw h;
				return h.Ra;
			}
		}
		function Fb(a, b, c, d) {
			if (y) return N(17, 1, a, b, c, d);
			try {
				a: {
					var e = Y(a);
					a = b;
					for (var g, h = (b = 0); h < c; h++) {
						var k = u()[a >> 2],
							m = u()[(a + 4) >> 2];
						a += 8;
						var l = B.write(e, f(), k, m, g);
						if (0 > l) {
							var n = -1;
							break a;
						}
						b += l;
						if (l < m) break;
						"undefined" != typeof g && (g += l);
					}
					n = b;
				}
				u()[d >> 2] = n;
				return 0;
			} catch (v) {
				if ("undefined" == typeof B || "ErrnoError" !== v.name) throw v;
				return v.Ra;
			}
		}
		var cc = (a) => a;
		y || qc();
		B.cd = (a, b, c, d, e, g, h, k, m, l) => {
			function n(I) {
				function E(x) {
					l?.();
					if (!k) {
						var H = a,
							L = b;
						H &&
							((H = "string" == typeof H ? H : jd(H)),
							(L = b ? S(H + "/" + b) : H));
						H = fd(d, e);
						L = B.create(L, H);
						if (x) {
							if ("string" == typeof x) {
								for (
									var F = Array(x.length), ma = 0, P = x.length;
									ma < P;
									++ma
								)
									F[ma] = x.charCodeAt(ma);
								x = F;
							}
							td(L, H | 146);
							F = B.open(L, 577);
							B.write(F, x, 0, x.length, 0, m);
							B.close(F);
							td(L, H);
						}
					}
					g?.();
					Na();
				}
				ed(I, v, E, () => {
					h?.();
					Na();
				}) || E(I);
			}
			var v = b ? Pc(S(a + "/" + b)) : a;
			C++;
			"string" == typeof c ? cd(c, n, h) : n(c);
		};
		B.$a = Array(4096);
		B.Oa(T, {}, "/");
		B.Va("/tmp");
		B.Va("/home");
		B.Va("/home/web_user");
		(() => {
			B.Va("/dev");
			Yc(B.kb(1, 3), { read: () => 0, write: (d, e, g, h) => h, Ua: () => 0 });
			sd("/dev/null", B.kb(1, 3));
			Xc(B.kb(5, 0), $c);
			Xc(B.kb(6, 0), ad);
			sd("/dev/tty", B.kb(5, 0));
			sd("/dev/tty1", B.kb(6, 0));
			var a = new Uint8Array(1024),
				b = 0,
				c = () => {
					0 === b && (b = Oc(a).byteLength);
					return a[--b];
				};
			B.jb("/dev", "random", c);
			B.jb("/dev", "urandom", c);
			B.Va("/dev/shm");
			B.Va("/dev/shm/tmp");
		})();
		(() => {
			B.Va("/proc");
			var a = B.Va("/proc/self");
			B.Va("/proc/self/fd");
			B.Oa(
				{
					Oa() {
						var b = B.createNode(a, "fd", 16895, 73);
						b.Ka = {
							ib(c, d) {
								var e = Y(+d);
								c = {
									parent: null,
									Oa: { lc: "fake" },
									Ka: { mb: () => e.path },
								};
								return (c.parent = c);
							},
						};
						return b;
					},
				},
				{},
				"/proc/self/fd",
			);
		})();
		B.Ac = { MEMFS: T, WORKERFS: W };
		T.ec = new B.Ja(44);
		T.ec.stack = "<generic error, no stack>";
		var Dd = [
				dc,
				oc,
				db,
				(a, b) => {
					if (y) return N(3, 1, a, b);
					try {
						var c = Y(a);
						return zd(B.stat, c.path, b);
					} catch (d) {
						if ("undefined" == typeof B || "ErrnoError" !== d.name) throw d;
						return -d.Ra;
					}
				},
				eb,
				(a, b) => {
					if (y) return N(5, 1, a, b);
					try {
						return (a = xd(a)), zd(B.kc, a, b);
					} catch (c) {
						if ("undefined" == typeof B || "ErrnoError" !== c.name) throw c;
						return -c.Ra;
					}
				},
				(a, b, c, d) => {
					if (y) return N(6, 1, a, b, c, d);
					try {
						b = xd(b);
						var e = d & 256;
						b = yd(a, b, d & 4096);
						return zd(e ? B.kc : B.stat, b, c);
					} catch (g) {
						if ("undefined" == typeof B || "ErrnoError" !== g.name) throw g;
						return -g.Ra;
					}
				},
				fb,
				gb,
				hb,
				ib,
				sb,
				zb,
				Ab,
				Cb,
				Db,
				Eb,
				Fb,
			],
			Ua,
			Z = (() => {
				function a(c, d) {
					Z = c.exports;
					pc.push(Z.na);
					O = Z.pa;
					Ga.unshift(Z.la);
					sa = d;
					Na();
					return Z;
				}
				C++;
				var b = Ta();
				if (w.instantiateWasm)
					try {
						return w.instantiateWasm(b, a);
					} catch (c) {
						A(`Module.instantiateWasm callback failed with error: ${c}`), ka(c);
					}
				if (y)
					return new Promise((c) => {
						va = (d) => {
							var e = new WebAssembly.Instance(d, Ta());
							a(e, d);
							c();
						};
					});
				Pa ??= Oa("qpdf.wasm")
					? "qpdf.wasm"
					: w.locateFile
						? w.locateFile("qpdf.wasm", z)
						: z + "qpdf.wasm";
				Sa(b, (c) => {
					a(c.instance, c.module);
				}).catch(ka);
				return {};
			})(),
			Md = (w._main = (a, b) => (Md = w._main = Z.ma)(a, b)),
			xa = () => (xa = Z.oa)(),
			za = (a, b, c, d, e, g) => (za = Z.qa)(a, b, c, d, e, g),
			Ea = () => (Ea = Z.ra)(),
			ic = (a, b, c, d, e) => (ic = Z.sa)(a, b, c, d, e),
			tc = (a) => (tc = Z.ta)(a),
			xc = (a) => (xc = Z.ua)(a),
			Hd = (a, b) => (Hd = Z.va)(a, b),
			Bd = () => (Bd = Z.wa)(),
			Q = (a, b) => (Q = Z.xa)(a, b),
			Fc = (a) => (Fc = Z.ya)(a),
			wc = (a, b) => (wc = Z.za)(a, b),
			M = (a) => (M = Z.Aa)(a),
			hc = (a) => (hc = Z.Ba)(a),
			K = () => (K = Z.Ca)(),
			Ec = (a) => (Ec = Z.Da)(a),
			Bc = (a) => (Bc = Z.Ea)(a),
			Gc = (a, b, c) => (Gc = Z.Fa)(a, b, c),
			Cc = (a) => (Cc = Z.Ga)(a),
			Nd = (w.dynCall_iiiiij = (a, b, c, d, e, g, h) =>
				(Nd = w.dynCall_iiiiij = Z.Ha)(a, b, c, d, e, g, h)),
			Od = (w.dynCall_iij = (a, b, c, d) =>
				(Od = w.dynCall_iij = Z.Ia)(a, b, c, d));
		function Ub(a, b, c) {
			var d = K();
			try {
				O.get(a)(b, c);
			} catch (e) {
				M(d);
				if (e !== e + 0) throw e;
				Q(1, 0);
			}
		}
		function Tb(a, b) {
			var c = K();
			try {
				O.get(a)(b);
			} catch (d) {
				M(c);
				if (d !== d + 0) throw d;
				Q(1, 0);
			}
		}
		function Zb(a, b, c, d, e, g, h, k) {
			var m = K();
			try {
				O.get(a)(b, c, d, e, g, h, k);
			} catch (l) {
				M(m);
				if (l !== l + 0) throw l;
				Q(1, 0);
			}
		}
		function Hb(a, b) {
			var c = K();
			try {
				return O.get(a)(b);
			} catch (d) {
				M(c);
				if (d !== d + 0) throw d;
				Q(1, 0);
			}
		}
		function Sb(a) {
			var b = K();
			try {
				O.get(a)();
			} catch (c) {
				M(b);
				if (c !== c + 0) throw c;
				Q(1, 0);
			}
		}
		function Ib(a, b, c) {
			var d = K();
			try {
				return O.get(a)(b, c);
			} catch (e) {
				M(d);
				if (e !== e + 0) throw e;
				Q(1, 0);
			}
		}
		function Wb(a, b, c, d, e) {
			var g = K();
			try {
				O.get(a)(b, c, d, e);
			} catch (h) {
				M(g);
				if (h !== h + 0) throw h;
				Q(1, 0);
			}
		}
		function Vb(a, b, c, d) {
			var e = K();
			try {
				O.get(a)(b, c, d);
			} catch (g) {
				M(e);
				if (g !== g + 0) throw g;
				Q(1, 0);
			}
		}
		function Xb(a, b, c, d, e, g) {
			var h = K();
			try {
				O.get(a)(b, c, d, e, g);
			} catch (k) {
				M(h);
				if (k !== k + 0) throw k;
				Q(1, 0);
			}
		}
		function ac(a, b, c, d, e, g, h, k, m, l, n) {
			var v = K();
			try {
				O.get(a)(b, c, d, e, g, h, k, m, l, n);
			} catch (I) {
				M(v);
				if (I !== I + 0) throw I;
				Q(1, 0);
			}
		}
		function Jb(a, b, c, d) {
			var e = K();
			try {
				return O.get(a)(b, c, d);
			} catch (g) {
				M(e);
				if (g !== g + 0) throw g;
				Q(1, 0);
			}
		}
		function Yb(a, b, c, d, e, g, h) {
			var k = K();
			try {
				O.get(a)(b, c, d, e, g, h);
			} catch (m) {
				M(k);
				if (m !== m + 0) throw m;
				Q(1, 0);
			}
		}
		function $b(a, b, c, d, e, g, h, k, m) {
			var l = K();
			try {
				O.get(a)(b, c, d, e, g, h, k, m);
			} catch (n) {
				M(l);
				if (n !== n + 0) throw n;
				Q(1, 0);
			}
		}
		function Nb(a, b, c, d, e, g, h) {
			var k = K();
			try {
				return O.get(a)(b, c, d, e, g, h);
			} catch (m) {
				M(k);
				if (m !== m + 0) throw m;
				Q(1, 0);
			}
		}
		function Kb(a, b, c, d, e) {
			var g = K();
			try {
				return O.get(a)(b, c, d, e);
			} catch (h) {
				M(g);
				if (h !== h + 0) throw h;
				Q(1, 0);
			}
		}
		function Mb(a, b, c, d, e, g) {
			var h = K();
			try {
				return O.get(a)(b, c, d, e, g);
			} catch (k) {
				M(h);
				if (k !== k + 0) throw k;
				Q(1, 0);
			}
		}
		function Lb(a, b, c, d, e, g) {
			var h = K();
			try {
				return O.get(a)(b, c, d, e, g);
			} catch (k) {
				M(h);
				if (k !== k + 0) throw k;
				Q(1, 0);
			}
		}
		function Ob(a, b, c, d, e, g, h, k) {
			var m = K();
			try {
				return O.get(a)(b, c, d, e, g, h, k);
			} catch (l) {
				M(m);
				if (l !== l + 0) throw l;
				Q(1, 0);
			}
		}
		function Pb(a, b, c, d, e, g, h, k, m, l, n, v) {
			var I = K();
			try {
				return O.get(a)(b, c, d, e, g, h, k, m, l, n, v);
			} catch (E) {
				M(I);
				if (E !== E + 0) throw E;
				Q(1, 0);
			}
		}
		function bc(a, b, c, d, e, g, h, k, m, l, n, v, I, E, x, H) {
			var L = K();
			try {
				O.get(a)(b, c, d, e, g, h, k, m, l, n, v, I, E, x, H);
			} catch (F) {
				M(L);
				if (F !== F + 0) throw F;
				Q(1, 0);
			}
		}
		function Gb(a, b, c) {
			var d = K();
			try {
				return O.get(a)(b, c);
			} catch (e) {
				M(d);
				if (e !== e + 0) throw e;
				Q(1, 0);
			}
		}
		function Qb(a, b, c, d, e, g, h) {
			var k = K();
			try {
				return Nd(a, b, c, d, e, g, h);
			} catch (m) {
				M(k);
				if (m !== m + 0) throw m;
				Q(1, 0);
			}
		}
		function Rb(a, b, c, d) {
			var e = K();
			try {
				return Od(a, b, c, d);
			} catch (g) {
				M(e);
				if (g !== g + 0) throw g;
				Q(1, 0);
			}
		}
		w.callMain = Pd;
		w.ENV = Jd;
		w.FS = B;
		w.WORKERFS = W;
		var Qd;
		Ma = function Rd() {
			Qd || Sd();
			Qd || (Ma = Rd);
		};
		function Pd(a = []) {
			var b = Md;
			a.unshift("./this.program");
			var c = a.length,
				d = hc(4 * (c + 1)),
				e = d;
			a.forEach((h) => {
				var k = u(),
					m = e >> 2,
					l = Uc(h) + 1,
					n = hc(l);
				Vc(h, aa(), n, l);
				k[m] = n;
				e += 4;
			});
			u()[e >> 2] = 0;
			try {
				var g = b(c, d);
				Bb(g, !0);
				return g;
			} catch (h) {
				return nc(h);
			}
		}
		function Sd() {
			if (!(0 < C))
				if (y) ja(w), Ja(), startWorker(w);
				else {
					if (w.preRun)
						for (
							"function" == typeof w.preRun && (w.preRun = [w.preRun]);
							w.preRun.length;
						)
							Fa.unshift(w.preRun.shift());
					Ka(Fa);
					0 < C ||
						Qd ||
						((Qd = !0),
						(w.calledRun = !0),
						ta || (Ja(), y || Ka(Ha), ja(w), Td && Pd(oa), y || Ka(Ia)));
				}
		}
		var Td = !0;
		w.noInitialRun && (Td = !1);
		Sd();
		Object.assign(B, {
			init: B.vb,
			mkdir: B.Va,
			mount: B.Oa,
			chdir: B.wc,
			writeFile: B.Sc,
			readFile: B.Jc,
			createLazyFile: B.yc,
			setIgnorePermissions: (a) => {
				B.Jb = a;
			},
		});
		moduleRtn = la;

		return moduleRtn;
	};
})();
export default init;
var isPthread = globalThis.self?.name?.startsWith("em-pthread");
// When running as a pthread, construct a new instance on startup
isPthread && init();
