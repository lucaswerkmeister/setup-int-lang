import process from 'node:process';
import Session, {
	ApiErrors,
	set,
} from 'm3api/node.js';

async function wikiLanguageCodes( session ) {
	const languageCodes = [];

	for await ( const response of session.requestAndContinue( {
		action: 'query',
		meta: set( 'languageinfo' ),
		liprop: set( 'code' ),
	} ) ) {
		for ( const language of Object.values( response.query.languageinfo ) ) {
			languageCodes.push( language.code );
		}
	}

	return languageCodes;
}

async function wikiSiteContentLanguage( session ) {
	const response = await session.request( {
		action: 'query',
		meta: set( 'siteinfo' ),
		siprop: set( 'general' ),
	} );
	return response.query.general.lang;
}

async function main() {
	if ( process.argv.length !== 3 ) {
		console.error( 'Usage: node index.js www.wikifunctions.org' );
		process.exitCode = 1;
		return;
	}
	const domain = process.argv[2];

	const accessToken = process.env.ACCESS_TOKEN;
	if ( !accessToken ) {
		console.error( 'ACCESS_TOKEN environment variable must be set!' );
		process.exitCode = 1;
		return;
	}

	const session = new Session( domain, {
		formatversion: 2,
		errorformat: 'plaintext',
	}, {
		authorization: `Bearer ${accessToken}`,
		userAgent: 'setup-int-lang (https://github.com/lucaswerkmeister/setup-int-lang/)',
	} );

	const [ languageCodes, siteContentLanguage ] = await Promise.all( [
		wikiLanguageCodes( session ),
		wikiSiteContentLanguage( session ),
	] );

	for ( const languageCode of languageCodes ) {
		const title = languageCode === siteContentLanguage
			? 'MediaWiki:Lang'
			: `MediaWiki:Lang/${languageCode}`;
		console.log( `Creating ${title}...` );
		try {
			await session.request( {
				action: 'edit',
				title,
				text: languageCode,
				summary: 'MediaWiki:Lang ({{int:lang}}) setup (https://github.com/lucaswerkmeister/setup-int-lang/)',
				bot: true,
				createonly: true,
				watchlist: 'unwatch',
			}, { method: 'POST', tokenType: 'csrf' } );
		} catch ( e ) {
			if (
				e instanceof ApiErrors
				&& e.errors.length === 1
				&& e.errors[0].code === 'articleexists'
			) {
				console.log( `Skipping ${title}, exists already.` );
			} else {
				throw e;
			}
		}
	}
}

await main();
