

document.addEventListener("DOMContentLoaded", async () => {
	// console.log('OnOpened')
	var lyrics = `La di da da-a, da-a (I like this flavor)
La da da da di da da-a, la-a
Let me tell you, I'm out here
From a very far away place
All for a chance to be a star
Nowhere seems to be too far
No more parties in L.A
Please, baby, no more parties in L.A., uh
No more parties in L.A
Please, baby, no more parties in L.A., uh
No more (Los Angeles)
Please (shake that body, party that bod-)
Please (shake that body, party that body)
Please (shake that body, party that body)
Hey baby you forgot your Ray Bans
And my sheets still orange from your spray tan
It was more than soft porn for the K-man
She remember my Sprinter, said "I was in the grape van"
Uhm, well cutie, I like your bougie booty
Come Erykah Badu me, well, let's make a movie
Hell, you know my repertoire is like a wrestler
I show you the ropes, connect the dots
A country girl that love Hollywood
Mama used to cook red beans and rice
Now it's Denny's, 4 in the morning, spoil your appetite
Liquor pouring and niggas swarming your section with erection
Smoke in every direction, middle finger pedestrians
R&B singers and lesbians, rappers and managers
Music and iPhone cameras
This shit unanimous for you, it's damaging for you, I think
That pussy should only be holding exclusive rights to me, I mean
He flew you in this motherfucker on first class
Even went out his way so you could check in an extra bag
Now you wanna divide the yam like it equate the math?
That shit don't add up, you're making him mad as fuck
She said she came out here to find an A-list rapper
I said baby, spin that round and say the alphabet backwards
You're dealing with malpractice, don't kill a good nigga's confidence
Just cause he a nerd and you don't know what a condom is
The head still good though, the head still good though
Make me say "Nam Myoho Renge Kyo"
Make a nigga say big words and act lyrical
Make me get spiritual
Make me believe in miracles, Buddhist monks and Cap'n Crunch cereal
Lord have mercy, thou will not hurt me
Five buddies all herded up on a Thursday
Bottle service, head service, I came in first place
The opportunity, the proper top of breast and booty cheek
The pop community, I mean these bitches come with union fee
And I want two of these, moving units through consumer streets
Then my shoe released, she was kicking in gratuity
And yeah G, I was all for it
She said K Lamar, you kind of dumb to be a poet
I'mma put you on game for the lames that don't know they're a rookie
Instagram is the best way to promote some pussy
Scary
Scary
No more parties in L.A
Please, baby, no more parties in L.A
Friday night tryna make it into the city
Breakneck speeds, passenger seat something pretty
Thinking back to how I got here in the first place
Second class bitches wouldn't let me on first base
A backpack nigga with luxury taste buds
And the Louis Vuitton store, got all of my pay stubs
Got pussy from beats I did for niggas more famous
When did I become A list? I wasn't even on a list
Strippers get invited to where they only get hired
When I get on my Steve Jobs, somebody gon' get fired
I was uninspired since Lauryn Hill retired
Any rumor you ever heard about me was true and legendary
I done got Lewinsky and paid secretaries
For all my niggas with babies by bitches
That use they kids as meal tickets
Not knowing the disconnect from the father
The next generation will be the real victims
I can't fault 'em really
I remember Amber told my boy no matter what happens she ain't going back to Philly
Back to our regularly scheduled programmin'
Of weak content and slow jammin'
But don't worry, this one's so jammin'
You know it, L.A., it's so jammin'
I be thinkin' every day
Mulholland Drive, need to put up some god damn barricades
I be paranoid every time
The pressure, the problem ain't I be drivin'
The problem is I be textin'
My psychiatrist got kids that I inspired
First song they played for me was 'bout their friend that just died
Textin' and drivin' down Mulholland Drive
That's why I'd rather take the 405
I be worried 'bout my daughter, I be worried 'bout Kim
But Saint is baby Ye, I ain't worried 'bout him
I had my life threatened by best friends who had selfish intents
What I'm supposed to do?
Ride around with a bulletproof car and some tints?
Every agent I know, know I hate agents
I'm too black, I'm too vocal, I'm too flagrant
Something smellin' like shit, that's the new fragrance
It's just me, I do it my way, bitch
Some days I'm in my Yeezys, some days I'm in my Vans
If I knew y'all made plans I wouldn't have popped the Xans
I know some fans who thought I wouldn't rap like this again
But the writer's block is over, emcees cancel your plans
A 38-year-old 8-year-old with rich nigga problems
Tell my wife that I hate the Rolls so I don't never drive it
It took 6 months to get the Maybach all matted out
And my assistant crashed it soon as they backed it out
God damn, got a bald fade, I might slam
Pink fur, got Nori dressing like Cam, thank God for me
Whole family gettin' money, thank God for E!
I love rockin' jewelry, a whole neck full
Bitches say he funny and disrespectful
I feel like Pablo when I'm workin' on my shoes
I feel like Pablo when I see me on the news
I feel like Pablo when I'm workin' on my house
Tell 'em party's in here, we don't need to go out
We need the turbo thots, high speed, turbo thots
Drop-dro-dro-dro-drop it like Robocop
She brace herself and hold my stomach, good dick'll do that
She keep pushin' me back, good dick'll do that
She push me back when the dick go too deep
This good dick'll put your ass to sleep
Get money, money, money, money
Big, big money, money, money, money
And as far as real friends, tell all my cousins I love 'em
Even the one that stole the laptop, you dirty motherfucker
I just keep on lovin' you, baby
And there's no one else I know who can take your place
Please, no more parties in L.A
Please, baby, no more parties in L.A., uh
No more parties in L.A
Please, baby, no more parties in L.A., uh
No more parties in L.A
Please, baby, no more parties in L.A., uh
No more (Los Angeles)
I'm out here from a very far away place
All for a chance to be a star
Nowhere seems to be too far
SWISH`

	var ls = []
	var container = document.querySelector('.container')
	var v = document.getElementById('view')
	var linesD = 7
	//v.textContent = lyrics
	ls = lyrics.split('\n')

	ls.forEach(l => {
		/* console.log(l) */
		var d = document.createElement('span');
		d.className = 'lyric sizeS'
		d.textContent = l
		v.appendChild(d)
	})

	const containerHeight = container.clientHeight;
	const lines = document.querySelectorAll('.lyric');
	var line = document.querySelector('.lyric')
	const lineHeight = window.getComputedStyle(line).getPropertyValue('line-height')

	const middleLineIndex = Math.floor((containerHeight / parseInt(lineHeight)) / 2)
	//console.log(middleLineIndex)

	v.addEventListener('scroll', () => {
		const scrollPosition = v.scrollTop;


		// const firstVisibleLine = Math.floor(scrollPosition / parseInt(lineHeight));
		// const lastVisibleLine = Math.ceil((scrollPosition + containerHeight) / parseInt(lineHeight));

		// var scrollTop = window.scrollY;
		// var scrollBottom = scrollTop + window.innerHeight;
		// var count = 0
		// for (var i = 0; i < lines.length; i++) {
		// 	if (lines[i].offsetTop >= scrollTop && lines[i].offsetTop <= scrollBottom) {
		// 		count += 1
		// 		console.log(lines[i].textContent);
		// 	}
		// }

		// console.log(count)



		// const visibleLines = Array.from({ length: lastVisibleLine - firstVisibleLine + 1 }, (_, i) => {
		// 	const lineIndex = firstVisibleLine + i;
		// 	return lines[lineIndex].textContent;
		// });

		// console.log('Currently visible lines:', visibleLines);



		// v.querySelectorAll('span').forEach((span, index) => {
		// 	span.classList.remove('active', 'above', 'below');
		// 	if (index === middleLineIndex) {
		// 		span.classList.add('sizeL');
		// 	} else if (index === middleLineIndex - 1 || index === middleLineIndex + 1) {
		// 		span.classList.add('sieM');
		// 	} else {
		// 		span.classList.add('sizeS');
		// 	}
		// });

	});


})

//********************TODO********************
//poc
//Add comms
//Save state
//Create popup layout
//Create menu
//Create lyrics view (On both extension and on youtube page (fullscreen & desktop version))
//Handle music change
//Handle non music
//add search
//Save frequently played lyrics (upto 25 for 2 month)
//Add manual search
//wrap console.logs inside debugMode
//Add dynamic user agent
//Fix runInContext calling
//Add loader for occassional misses
//Without Me - Edge Case - Not Found
//remove lyrics view when non music video plays
//delete > 15 day data
//add diagnostics
//url encode search
//move to bing
