const async			= require('async');
const _				= require('lodash');
const googleTrends	= require('google-trends-api');

const keywords		= [
	["The Fed Balance Sheet", "Fed Fund Rate", "North Korea Geopolitical Tension on Economy", "Bond Market Sell-off", "Downturn Chinese Economy", "US Tax Reform", "Brexit", "Oil and Commodity Prices Weakening", "China Structural Reform", "Abenomics Policy of Consumption tax hike in Japan", "Proteksionisme Internasional", "EU Normalization Policy", "China Debt", "Japan Quantitative Easing"],
	["Rebound Oil and Commodity Prices: Commodity Exporter Countries", "Recovery World Trade", "Productivity Rebound", "US Credit Expansion", "Brexit spurs EU Reform", "Monetary Tightening Delayed", "Eurozone Growth Stronger", "Fiscal Policy Loosened Globally", "Abenomics Policy"],
	["Harga Barang Administered meningkat", "Harga Komoditas Ekspor Stagnan", "Ketidakpastian Politik Indonesia", "Volatilitas Nilai Tukar Rupiah", "Pilkada 2018", "NPL Tinggi", "Pertumbuhan kredit perbankan lambat", "Ruang fiskal terbatas", "Penerimaan pajak rendah", "Perlambatan sektor industri", "Investasi Lambat", "Penciptaan lapangan kerja sedikit"],
	["Pertumbuhan Ekonomi Global Membaik", "Harga Minyak Dunia", "Harga Komoditas Ekspor meningkat", "Proyek Infrastruktur", "Pilkada 2018", "Ketidakpastian Politik Indonesia", "Suku bunga turun", "Reformasi struktural"]
]

function checkAvail(keywords, checkBack) {
	async.map(keywords, (key, callback) => {
		googleTrends.interestOverTime({ keyword: key })
			.then((results) => {
				// console.log(_.chain(JSON.parse(results)).get('default.timelineData').isEmpty().value());
				callback(null, (!_.chain(JSON.parse(results)).get('default.timelineData').isEmpty().value() ? key : null));
			})
			.catch((err) => {
				callback(err);
			});
	}, (err, results) => {
		checkBack(err, _.compact(results));
	})
}

function findRank(left, iterate, findBack) {
	let rank		= [];
	let noresult	= [];
	let baseKey		= '';

	let sampled		= _.sampleSize(left, 5);
	async.whilst(
		() => (left.length > 0),
		(whileback) => {
			let data	= {};
			googleTrends.interestOverTime({ keyword: sampled })
				.then((results) => {
					// console.log(sampled.map((o, i) => (i + '. ' + o)).join('\n'));
					// console.log(results);
					let timeline	= _.get(JSON.parse(results), 'default.timelineData', []);
					if (!_.isEmpty(timeline)) {
						let flag	= _.times(sampled.length, _.constant(false));
						_.forEach(timeline, (o) => {
							let value	= _.get(o, 'value', []);
							_.forEach(value, (v, i) => {
								if (!flag[i] && v > 0) { flag[i] = true; data[i] = []; }
								if (flag[i]) { data[i].push(v); }
							});
						});

						if (_.size(data) > 1) {
							let avgs		= _.map(data, (o, i) => ({ val: _.mean(o), key: sampled[i] }));
							let multiplier	= 1;
							if (baseKey !== '') {
								let current	= _.chain(avgs).find(['key', baseKey]).get('val', 1).value();
								multiplier	= _.chain(rank).find(['key', baseKey]).get('val', 1).divide(current).value();

								avgs		= _.chain(avgs).filter((o) => (o.key !== baseKey)).map((o) => ({ val: _.round(o.val * multiplier, 2), key: o.key })).value();
							} else {
								let mid		= _.chain(avgs).sortBy('val').nth(_.floor(avgs.length / 2)).get('val', 1).value();
								multiplier	= Math.pow(100, iterate) / mid;

								avgs		= _.map(avgs, (o) => ({ val: _.round(o.val * multiplier, 2), key: o.key }));
							}
							rank	= _.concat(rank, avgs);
							_.pullAll(left, _.map(avgs, 'key'));

						} else {
							let solo	= _.chain(data).map((o, i) => ({ val: 'inf', key: sampled[i] })).first().value();
							if (!_.chain(rank).map('key').includes(solo.key).value()) {
								rank.push(solo);
								_.pull(left, solo.key);
							} else {
								noresult	= _.concat(noresult, _.pull(sampled, solo.key));
								_.pullAll(left, sampled);
							}
						}
					} else {
						noresult	= _.concat(noresult, sampled);
						_.pullAll(left, sampled);
					}

					let filterd	= _.filter(rank, (o) => (o.val !== 'inf'));

					baseKey		= _.chain(filterd).sortBy('val').first().get('key', '').value();
					sampled		= !_.isEmpty(baseKey) ? _.chain(left).sampleSize(4).concat([baseKey]).value() : _.sampleSize(left, 5);

					whileback(null);
				})
				.catch((err) => {
					console.log(err);
					whileback(err);
				});
		},
		(err, results) => {
			// console.log(results);
			findBack(null, rank, noresult);
		}
	);
}

async.map(keywords, (keyword, callback) => {
	let thorough	= false;
	let iterate		= 3;

	let rank		= [];
	let noresult	= [];

	checkAvail(keyword, (err, left) => {
		async.whilst(
			() => (!thorough && !_.isEmpty(left)),
			(whileback) => {
				findRank(left, iterate, (err, result, norslt) => {
					noresult	= _.concat(noresult, norslt)
					rank		= _.chain(result).filter((o) => (o.val !== 'inf')).concat(rank).value();
					untold		= _.filter(result, ['val', 'inf']);
					if (untold.length == 1) { thorough = true; rank = _.concat(rank, untold); } else { left = _.map(untold, 'key'); iterate++; }

					whileback(null);
				});
			},
			(err) => {
				console.log(_.sortBy(rank, 'val'));
				callback();
			}
		);
	});
}, (err, results) => {
	// console.log(results);
});
