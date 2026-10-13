import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import rubric from './rubric.json';
import type { Style } from '@react-pdf/types';
import type { Review, Verdict, MeetingMetrics } from './types';
import { METRIC_CAVEAT, metricRows, verdictLabel } from './report';

// A widescreen slide deck (PowerPoint's 13.33 × 7.5 in) in the app's Editorial palette and type.
// The fonts are the app's own OFL files, bundled as static assets: the PDF is built on the device
// and fetches nothing except those files from this site.
const W=960,H=540,M=56;
const fontSrc=(url:URL)=>url.protocol==='file:'?decodeURIComponent(url.pathname):url.href;
Font.register({family:'Fraunces',src:fontSrc(new URL('./pdf-fonts/fraunces-latin-400-normal.woff',import.meta.url))});
Font.register({family:'Plex',fonts:[
  {src:fontSrc(new URL('./pdf-fonts/ibm-plex-sans-latin-400-normal.woff',import.meta.url))},
  {src:fontSrc(new URL('./pdf-fonts/ibm-plex-sans-latin-600-normal.woff',import.meta.url)),fontWeight:600},
  {src:fontSrc(new URL('./pdf-fonts/ibm-plex-sans-latin-400-italic.woff',import.meta.url)),fontStyle:'italic'},
]});
Font.registerHyphenationCallback(word=>[word]);
const C={paper:'#f7f3eb',surface:'#fcfaf5',rose:'#eee2df',rule:'#d8ccc3',ink:'#332a2b',muted:'#6f5d59',accent:'#6c253e',sage:'#4a6a52',sageTint:'#e3e9de',sageRule:'#c8d3c2'};
const s=StyleSheet.create({
  // lineHeight belongs on the page: set lower down, react-pdf mismeasures unbreakable blocks and breaks slides early.
  page:{backgroundColor:C.paper,paddingTop:38,paddingBottom:60,paddingHorizontal:M,fontFamily:'Plex',fontSize:11,lineHeight:1.45,color:C.ink},
  // Positioned from the top: with a page lineHeight, react-pdf drops a footer anchored with `bottom`.
  footer:{position:'absolute',left:M,right:M,top:H-38,flexDirection:'row',justifyContent:'space-between',borderTopWidth:0.75,borderTopColor:C.rule,paddingTop:7,fontSize:8,color:C.muted},
  eyebrow:{fontSize:8.5,fontWeight:600,letterSpacing:1.4,textTransform:'uppercase',color:C.accent,marginBottom:6},
  h1:{fontFamily:'Fraunces',fontSize:30,lineHeight:1.12,marginBottom:20},
  // Title slide
  cover:{flexDirection:'row',backgroundColor:C.paper,fontFamily:'Plex',color:C.ink},
  coverMain:{flex:1,paddingLeft:M,paddingRight:44,paddingTop:42,paddingBottom:38,justifyContent:'space-between'},
  wordmark:{fontFamily:'Fraunces',fontSize:19},
  coverTitle:{fontFamily:'Fraunces',fontSize:46,lineHeight:1.06,marginBottom:14},
  coverLead:{fontSize:14,lineHeight:1.45,color:C.muted,maxWidth:470},
  metaRow:{flexDirection:'row',gap:40,marginBottom:18},
  metaLabel:{fontSize:8,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase',color:C.muted,marginBottom:3},
  metaValue:{fontSize:12},
  coverNote:{fontSize:9,color:C.muted,borderTopWidth:0.75,borderTopColor:C.rule,paddingTop:8},
  demo:{alignSelf:'flex-start',backgroundColor:C.sageTint,color:C.sage,fontSize:9,fontWeight:600,paddingHorizontal:10,paddingVertical:4,borderRadius:10,marginBottom:14},
  panel:{width:316,backgroundColor:C.accent,paddingHorizontal:40,paddingVertical:44,justifyContent:'center',color:C.surface},
  panelLabel:{fontSize:9,fontWeight:600,letterSpacing:1.6,textTransform:'uppercase',color:C.surface,marginBottom:4},
  panelValue:{fontFamily:'Fraunces',fontSize:104,lineHeight:1.05,color:C.surface},
  panelOf:{fontSize:16,color:C.surface,marginBottom:24},
  panelNote:{fontSize:10,lineHeight:1.5,color:C.surface,marginBottom:8},
  // Scores at a glance
  split:{flexDirection:'row',gap:40},
  scoreRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:0.75,borderBottomColor:C.rule},
  scoreName:{width:150,fontSize:11.5,fontWeight:600},
  track:{flex:1,height:9,backgroundColor:C.rose,borderRadius:5,marginHorizontal:16},
  fill:{height:9,backgroundColor:C.accent,borderRadius:5},
  scoreValue:{width:58,textAlign:'right',fontFamily:'Fraunces',fontSize:16},
  scoreNa:{width:58,textAlign:'right',fontSize:10,color:C.muted},
  card:{borderRadius:16,padding:22},
  cardTitle:{fontFamily:'Fraunces',fontSize:20,lineHeight:1.2,marginBottom:10},
  label:{fontSize:8.5,fontWeight:600,letterSpacing:1.2,textTransform:'uppercase',color:C.muted,marginBottom:4},
  // Numbers
  tiles:{flexDirection:'row',flexWrap:'wrap',gap:14},
  tile:{width:(W-2*M-28)/3,height:112,backgroundColor:C.sageTint,borderRadius:14,paddingHorizontal:18,paddingVertical:14},
  tileLabel:{fontSize:8.5,fontWeight:600,letterSpacing:1.1,textTransform:'uppercase',color:C.sage},
  tileValue:{fontFamily:'Fraunces',fontSize:32,lineHeight:1.15,marginTop:6},
  tileHint:{fontSize:9,color:C.muted},
  note:{fontSize:8.5,lineHeight:1.5,color:C.muted,marginTop:12,maxWidth:780},
  // Takeaways
  listRow:{flexDirection:'row',alignItems:'center',paddingVertical:12,borderBottomWidth:0.75,borderBottomColor:C.rule},
  listNumber:{width:48,fontFamily:'Fraunces',fontSize:26,color:C.accent},
  listTitle:{flex:1,fontFamily:'Fraunces',fontSize:18,lineHeight:1.2},
  pill:{fontSize:8.5,fontWeight:600,lineHeight:1.2,paddingHorizontal:10,paddingVertical:4,borderRadius:10},
  bigNumber:{width:150,fontFamily:'Fraunces',fontSize:120,lineHeight:1,color:C.accent},
  takeTitle:{fontFamily:'Fraunces',fontSize:30,lineHeight:1.15,marginBottom:16},
  takeLearning:{fontSize:15,lineHeight:1.5,maxWidth:620},
  // Category slides
  // Pinned like the footer: an in-flow fixed header is counted twice and wastes slide height.
  catHeader:{position:'absolute',top:38,left:M,right:M,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},
  catName:{fontFamily:'Fraunces',fontSize:28,lineHeight:1.12},
  scoreBadge:{flexDirection:'row',alignItems:'flex-end',backgroundColor:C.accent,borderRadius:12,paddingHorizontal:16,paddingVertical:6},
  scoreBadgeValue:{fontFamily:'Fraunces',fontSize:24,lineHeight:1.15,color:C.surface},
  scoreBadgeOf:{fontSize:11,color:C.surface,marginLeft:4,marginBottom:5},
  naBadge:{borderWidth:0.75,borderColor:C.rule,borderRadius:12,paddingHorizontal:14,paddingVertical:8,fontSize:10,color:C.muted},
  summary:{fontSize:12.5,lineHeight:1.5,maxWidth:800,marginBottom:12},
  criterion:{flexDirection:'row',gap:26,borderTopWidth:0.75,borderTopColor:C.rule,paddingVertical:11},
  criterionLeft:{width:270},
  criterionText:{fontSize:10.5,fontWeight:600,lineHeight:1.4,marginTop:7},
  criterionRight:{flex:1},
  rationale:{fontSize:10.5,lineHeight:1.5},
  evidence:{marginTop:8,borderLeftWidth:2,borderLeftColor:C.accent,paddingLeft:10},
  quote:{fontStyle:'italic',fontSize:10.5,lineHeight:1.45},
  cite:{fontSize:8.5,color:C.muted,marginTop:2},
  // About
  aboutPoint:{flexDirection:'row',marginBottom:12},
  dot:{width:6,height:6,borderRadius:3,backgroundColor:C.accent,marginTop:6,marginRight:12},
  provRow:{flexDirection:'row',paddingVertical:7,borderBottomWidth:0.75,borderBottomColor:C.rule},
  provLabel:{width:84,fontSize:8.5,fontWeight:600,letterSpacing:1,textTransform:'uppercase',color:C.muted,paddingTop:1.5},
  provValue:{flex:1,fontSize:10},
});
const verdictStyle:Record<Verdict,Style>={
  met:{backgroundColor:C.sage,color:C.surface},
  partially_met:{backgroundColor:C.sageTint,color:C.sage},
  not_met:{backgroundColor:C.accent,color:C.surface},
  not_assessable:{borderWidth:0.75,borderColor:C.rule,color:C.muted},
};
// Small text runs avoid a renderer overflow bug on oversized source paragraphs.
// Slices preserve all characters; no reasoning or evidence is truncated.
function flowing(text:string,style:Style|Style[],key:string){
  const pieces:string[]=[];let rest=text;
  while(rest.length>600){let cut=rest.lastIndexOf(' ',600);if(cut<200)cut=600;else cut++;pieces.push(rest.slice(0,cut));rest=rest.slice(cut);}
  if(rest)pieces.push(rest);
  return pieces.map((piece,i)=><Text key={`${key}-${i}`} style={style}>{piece}</Text>);
}
// A criterion stays on one slide when it plausibly fits (rough line estimate for the 552 pt evidence column);
// a very long one may break between quotes, and only a quote too long for any slide breaks inside itself.
const lines=(text:string)=>Math.ceil(text.length/88)||1;
const fitsOneSlide=(rationale:string,quotes:string[])=>22+lines(rationale)*15.5+quotes.reduce((h,q)=>h+8+lines(q)*15.5+14,0)<360;
const metricHint=(label:string,m:MeetingMetrics)=>({
  'Adviser talk share':'Of adviser and client speech','Question turns':'Adviser turns ending in a question mark',
  'Longest adviser span':'Longest uninterrupted adviser stretch','Longest client span':'Longest uninterrupted client stretch',
  'Duration':m.duration_is_estimate?'Estimated from the transcript':'Supplied by the adviser',
  'Client speaking balance':'Larger to smaller share; two separate client voices only',
} as Record<string,string>)[label]??'';
function Footer({name,demo}:{name:string;demo:boolean}){
  return <View style={s.footer} fixed><Text>Meeting Coach · {name}{demo?' · Synthetic demonstration':''}</Text><Text render={({pageNumber,totalPages})=>`${pageNumber} / ${totalPages}`}/></View>;
}
// Every slide wraps: react-pdf sizes a non-wrapping page to its content, which misplaces the footer.
function Slide({name,demo,children,centred=false,header}:{name:string;demo:boolean;children:React.ReactNode;centred?:boolean;header?:React.ReactNode}){
  return <Page size={[W,H]} style={[s.page,centred?{justifyContent:'center'}:{},header?{paddingTop:122}:{}]} wrap>{header&&<View style={s.catHeader} fixed>{header}</View>}{children}<Footer name={name} demo={demo}/></Page>;
}
export function ReportDocument({review,title}:{review:Review;title:string}){
  const name=title||'Your meeting review';const demo=review.demo;const m=review.metrics;
  const date=new Date(review.generatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
  const assessed=review.scores.filter(x=>x.value!==null).length;
  const scoreOf=(id:string)=>review.scores.find(x=>x.score_id===id)!;
  return <Document title={`Meeting Coach review · ${name}`} author="Meeting Coach" subject="Adviser communication and meeting craft" language="en-GB">
    {/* Title */}
    <Page size={[W,H]} style={s.cover}>
      <View style={s.coverMain}>
        <Text style={s.wordmark}>Meeting Coach<Text style={{color:C.accent}}>.</Text></Text>
        <View>
          {demo&&<Text style={s.demo}>Synthetic demonstration · illustrative scores</Text>}
          <Text style={s.eyebrow}>Adviser coaching review</Text>
          <Text style={s.coverTitle}>{name}</Text>
          <Text style={s.coverLead}>Communication and meeting craft, with evidence from the transcript.</Text>
        </View>
        <View>
          <View style={s.metaRow}>
            <View><Text style={s.metaLabel}>Date</Text><Text style={s.metaValue}>{date}</Text></View>
            <View><Text style={s.metaLabel}>Duration</Text><Text style={s.metaValue}>{m.duration_min===null?'n/a':`${m.duration_min} min${m.duration_is_estimate?' (est.)':''}`}</Text></View>
            <View><Text style={s.metaLabel}>Categories assessed</Text><Text style={s.metaValue}>{assessed} of {rubric.scores.length}</Text></View>
          </View>
          <Text style={s.coverNote}>Coaching, not a compliance certificate or client advice. AI judgment can vary and needs your review.</Text>
        </View>
      </View>
      <View style={s.panel}>
        <Text style={s.panelLabel}>Overall</Text>
        <Text style={s.panelValue}>{review.overall===null?'n/a':String(review.overall)}</Text>
        <Text style={s.panelOf}>{review.overall===null?'No category was assessable':'out of 5'}</Text>
        <Text style={s.panelNote}>The equal-weight average of the assessable categories. Categories without evidence are excluded.</Text>
      </View>
    </Page>
    {/* Scores at a glance */}
    <Slide name={name} demo={demo}>
      <Text style={s.eyebrow}>At a glance</Text><Text style={s.h1}>Scores by category</Text>
      <View style={s.split}>
        <View style={{flex:1}}>{rubric.scores.map(def=>{const x=scoreOf(def.id);return <View style={s.scoreRow} key={def.id}>
          <Text style={s.scoreName}>{def.name}</Text>
          <View style={s.track}>{x.value!==null&&<View style={[s.fill,{width:`${x.value/5*100}%`}]}/>}</View>
          {x.value===null?<Text style={s.scoreNa}>n/a</Text>:<Text style={s.scoreValue}>{x.value} / 5</Text>}
        </View>;})}</View>
        <View style={[s.card,{width:320,backgroundColor:C.rose}]}>
          <Text style={s.eyebrow}>Something to keep doing</Text>
          <Text style={s.cardTitle}>{review.coaching[0].title}</Text>
          {flowing(review.coaching[0].learning,{fontSize:11,lineHeight:1.5,marginBottom:12},'focus-learning')}
          <Text style={s.label}>In this meeting</Text>
          {flowing(review.coaching[0].example,{fontSize:10,lineHeight:1.5,color:C.muted},'focus-example')}
        </View>
      </View>
    </Slide>
    {/* Numbers */}
    <Slide name={name} demo={demo}>
      <Text style={s.eyebrow}>The conversation in numbers</Text><Text style={s.h1}>How the time was shared</Text>
      <View style={s.tiles}>{metricRows(m).map(([label,value])=><View style={s.tile} key={label}>
        <Text style={s.tileLabel}>{label}</Text><Text style={s.tileValue}>{value}</Text><Text style={s.tileHint}>{metricHint(label,m)}</Text>
      </View>)}</View>
      {m.client_shares.length>0&&<Text style={[s.note,{color:C.ink,fontSize:10}]}>Client shares of adviser and client speech: {m.client_shares.map(c=>`${c.speaker} ${Math.round(c.share*100)}%`).join('; ')}.</Text>}
      <Text style={s.note}>{METRIC_CAVEAT} Basis: {m.basis==='words'?'word counts at 140 words per minute.':'timestamp gaps, with word estimates for repeated timestamps and an unknown final tail.'} Observer speech is excluded from adviser and client shares and spans.</Text>
    </Slide>
    {/* Five things: overview */}
    <Slide name={name} demo={demo}>
      <Text style={s.eyebrow}>Five things to take forward</Text><Text style={s.h1}>What to carry into your next meeting</Text>
      {review.coaching.map((t,i)=><View style={s.listRow} key={i}>
        <Text style={s.listNumber}>{i+1}</Text><Text style={s.listTitle}>{t.title}</Text>
        {i===0&&<Text style={[s.pill,{backgroundColor:C.sageTint,color:C.sage}]}>Keep doing</Text>}
      </View>)}
    </Slide>
    {/* Five things: one slide each */}
    {review.coaching.map((t,i)=><Slide name={name} demo={demo} key={`take-${i}`} centred>
      <View style={{flexDirection:'row'}}>
        <Text style={[s.bigNumber,i===0?{color:C.sage}:{}]}>{i+1}</Text>
        <View style={{flex:1}}>
          <Text style={[s.eyebrow,i===0?{color:C.sage}:{}]}>Takeaway {i+1} of {review.coaching.length}{i===0?' · Something to keep doing':''}</Text>
          <Text style={s.takeTitle}>{t.title}</Text>
          {flowing(t.learning,s.takeLearning,`learning-${i}`)}
          <View style={[s.card,{marginTop:22,backgroundColor:i===0?C.sageTint:C.rose,padding:18}]}>
            <Text style={s.label}>In this meeting</Text>
            {flowing(t.example,{fontSize:12,lineHeight:1.5},`example-${i}`)}
          </View>
        </View>
      </View>
    </Slide>)}
    {/* One slide per category; long categories continue on further slides under the same header */}
    {rubric.scores.map((def,i)=>{const x=scoreOf(def.id);return <Slide name={name} demo={demo} key={def.id} header={<>
        <View style={{flex:1,paddingRight:24}}><Text style={s.eyebrow}>Category {i+1} of {rubric.scores.length}</Text><Text style={s.catName}>{def.name}</Text></View>
        {x.value===null?<Text style={s.naBadge}>Not assessable</Text>:<View style={s.scoreBadge}><Text style={s.scoreBadgeValue}>{x.value}</Text><Text style={s.scoreBadgeOf}>/ 5</Text></View>}
      </>}>
      {flowing(x.summary,s.summary,`${def.id}-summary`)}
      {def.criteria.map(c=>{const r=x.criteria.find(y=>y.criterion_id===c.id)!;return <View style={s.criterion} key={c.id} wrap={!fitsOneSlide(r.rationale,r.evidence.map(e=>e.quote))}>
        <View style={s.criterionLeft}>
          <Text style={[s.pill,{alignSelf:'flex-start'},verdictStyle[r.verdict]]}>{verdictLabel(r.verdict)}</Text>
          <Text style={s.criterionText}>{c.text}</Text>
        </View>
        <View style={s.criterionRight}>
          {flowing(r.rationale,s.rationale,`${c.id}-rationale`)}
          {r.evidence.map((e,k)=><View style={s.evidence} key={k} wrap={lines(e.quote)*15.5+16>300}>
            {flowing(`“${e.quote}”`,s.quote,`${c.id}-quote-${k}`)}
            <Text style={s.cite}>{e.speaker} · {e.timestamp||e.segment_id.replace('segment-','Segment ')}</Text>
          </View>)}
        </View>
      </View>;})}
    </Slide>;})}
    {/* About */}
    <Slide name={name} demo={demo}>
      <Text style={s.eyebrow}>About this review</Text><Text style={s.h1}>How to read it</Text>
      <View style={s.split}>
        <View style={{flex:1}}>{[
          'Scores are an AI judgment of your meeting against a firm-defined rubric. AI judgment can vary and needs your review.',
          'Every quote was checked word for word against the transcript. That does not verify the model’s interpretation.',
          'The overall score is the equal-weight average of the assessable categories. Categories without evidence are excluded.',
          'Coaching, not a compliance certificate or client advice.',
          'Meeting Coach does not save transcript text, quotes or written reviews. A saved PDF remains on your device after clearing the app.',
        ].map((p,k)=><View style={s.aboutPoint} key={k}><View style={s.dot}/><Text style={{flex:1,fontSize:11.5,lineHeight:1.5}}>{p}</Text></View>)}</View>
        <View style={[s.card,{width:340,backgroundColor:C.surface,borderWidth:0.75,borderColor:C.rule}]}>
          <Text style={s.eyebrow}>Provenance</Text>
          {[['Model',review.model],['Prompt',review.promptVersion],['Rubric',review.rubricVersion],['Generated',new Date(review.generatedAt).toLocaleString('en-GB')],['Report',review.reportId]].map(([k,v])=><View style={s.provRow} key={k}><Text style={s.provLabel}>{k}</Text><Text style={s.provValue}>{v}</Text></View>)}
        </View>
      </View>
    </Slide>
  </Document>;
}
export async function generatePdf(review:Review,title:string){return pdf(<ReportDocument review={review} title={title}/>).toBlob();}
