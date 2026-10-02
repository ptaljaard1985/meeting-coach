import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import rubric from './rubric.json';
import type { Style } from '@react-pdf/types';
import type { Review } from './types';
import { METRIC_CAVEAT, metricRows, verdictLabel } from './report';
// Built-in PDF fonts: no remote font or server PDF fetch.
const styles=StyleSheet.create({
  page:{paddingTop:42,paddingBottom:66,paddingHorizontal:44,fontFamily:'Helvetica',fontSize:10,lineHeight:1.4,color:'#24312c'},
  title:{flexShrink:0,fontFamily:'Times-Roman',fontSize:29,lineHeight:1.15,marginBottom:8},
  subtitle:{flexShrink:0,fontSize:12,lineHeight:1.4,marginBottom:12},h2:{flexShrink:0,fontFamily:'Times-Roman',fontSize:19,lineHeight:1.25,marginTop:20,marginBottom:10},
  h3:{flexShrink:0,fontFamily:'Helvetica-Bold',fontSize:11,lineHeight:1.4,marginBottom:5},small:{flexShrink:0,fontSize:8,lineHeight:1.4,color:'#4a5750'},
  overall:{flexShrink:0,fontSize:24,lineHeight:1.25,fontFamily:'Helvetica-Bold',marginTop:6,marginBottom:8},
  row:{flexShrink:0,flexDirection:'row',justifyContent:'space-between',paddingVertical:7,gap:10},
  scoreName:{fontFamily:'Helvetica-Bold',fontSize:12,lineHeight:1.4},score:{fontFamily:'Helvetica-Bold',fontSize:12,lineHeight:1.4},
  paragraph:{flexShrink:0,marginBottom:7},takeaway:{marginBottom:15},criterion:{marginTop:11,paddingTop:10,borderTopWidth:0.5,borderTopColor:'#c6cec8'},
  quote:{flexShrink:0,paddingLeft:10,marginVertical:7},
  footer:{height:30,position:'absolute',bottom:25,left:44,right:44,fontSize:7,lineHeight:1.2,color:'#4a5750',paddingTop:6},
  demo:{flexShrink:0,fontFamily:'Helvetica-Bold',marginVertical:8},
});
// Small text runs avoid a renderer overflow bug on oversized source paragraphs.
// Slices preserve all characters; no reasoning or evidence is truncated.
function flowing(text:string,style:Style|Style[],key:string){
  const pieces:string[]=[];let rest=text;
  while(rest.length>600){let cut=rest.lastIndexOf(' ',600);if(cut<200)cut=600;else cut++;pieces.push(rest.slice(0,cut));rest=rest.slice(cut);}
  if(rest)pieces.push(rest);
  return pieces.map((piece,i)=><Text key={`${key}-${i}`} style={style}>{piece}</Text>);
}
export function ReportDocument({review,title}:{review:Review;title:string}){return <Document title="Meeting Coach review" author="Meeting Coach" subject="Adviser communication and meeting craft" language="en-GB"><Page size="A4" style={styles.page} wrap>
  <Text style={styles.title}>Meeting Coach</Text><Text style={styles.subtitle}>{title||'Your meeting review'}</Text>
  <Text style={styles.small}>Adviser coaching. Not a compliance certificate or client advice.</Text>
  {review.demo&&<Text style={styles.demo}>Synthetic demonstration - illustrative scores, not an AI assessment.</Text>}
  <Text style={styles.overall}>Overall: {review.overall===null?'n/a':`${review.overall} / 5`}</Text><Text style={styles.paragraph}>Equal-weight average of assessable categories; n/a categories are excluded. AI judgment can vary and requires human review.</Text>
  <Text style={styles.h2}>Conversation metrics</Text>{metricRows(review.metrics).map(([label,value])=><View style={styles.row} key={label}><Text>{label}</Text><Text>{value}</Text></View>)}
  <Text style={[styles.small,{marginTop:8}]}>{METRIC_CAVEAT} Basis: {review.metrics.basis==='words'?'word counts at 140 words per minute':'timestamp gaps; repeated starts and unknown tail use word estimates'}. Known duration is a total-duration fact, never an invented evidence timestamp. Observer speech is excluded from adviser/client shares and spans.</Text>
  {review.metrics.client_shares.length>0&&<Text style={styles.small}>Client shares of adviser/client speech: {review.metrics.client_shares.map(c=>`${c.speaker} ${Math.round(c.share*100)}%`).join('; ')}.</Text>}
  <Text style={styles.h2}>Score summaries</Text>{rubric.scores.map(def=>{const s=review.scores.find(x=>x.score_id===def.id)!;return <React.Fragment key={def.id}><View style={styles.row} wrap={false}><Text style={styles.scoreName}>{def.name}</Text><Text style={styles.score}>{s.value===null?'n/a':`${s.value} / 5`}</Text></View>{flowing(s.summary,styles.paragraph,def.id+'-summary')}</React.Fragment>;})}
  <Text style={styles.h2}>Five things to take forward</Text>{review.coaching.map((t,i)=><React.Fragment key={i}><Text style={styles.h3}>{i+1}. {t.title}</Text>{flowing(t.learning,styles.paragraph,'learning-'+i)}{flowing('In this meeting: '+t.example,[styles.paragraph,{marginBottom:15}],'example-'+i)}</React.Fragment>)}
  <Text style={styles.h2} break>Criterion evidence &amp; rationale</Text>{rubric.scores.map(def=>{const s=review.scores.find(x=>x.score_id===def.id)!;return <React.Fragment key={def.id}><Text style={styles.h2}>{def.name} - {s.value===null?'n/a':`${s.value} / 5`}</Text>{def.criteria.map(c=>{const result=s.criteria.find(x=>x.criterion_id===c.id)!;return <React.Fragment key={c.id}><Text style={[styles.h3,{marginTop:12}]}>{c.text}</Text><Text style={styles.small}>{verdictLabel(result.verdict)}</Text>{flowing(result.rationale,styles.paragraph,c.id+'-rationale')}{result.evidence.map((e,i)=><React.Fragment key={i}>{flowing('“'+e.quote+'”',styles.quote,c.id+'-quote-'+i)}<Text style={styles.small}>{e.speaker} | {e.timestamp||e.segment_id.replace('segment-','Segment ')}</Text></React.Fragment>)}</React.Fragment>;})}</React.Fragment>;})}
  <Text style={[styles.small,{marginTop:20}]}>{review.model} | Prompt {review.promptVersion} | Rubric {review.rubricVersion}{'\n'}Generated {review.generatedAt} | Local report {review.reportId}{'\n'}Quotes are checked against source speech. That does not verify the model’s interpretation. A saved PDF remains on your device after clearing the app.</Text>
  <View style={styles.footer} fixed wrap={false}>
    <Text>Meeting Coach | {review.generatedAt.slice(0,10)} | {review.reportId}</Text>
    <Text>{review.model} | {review.promptVersion} | {review.rubricVersion}</Text>
  </View>
  </Page></Document>;}
export async function generatePdf(review:Review,title:string){return pdf(<ReportDocument review={review} title={title}/>).toBlob();}
