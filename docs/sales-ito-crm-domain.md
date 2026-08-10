# Nghiệp vụ Sales B2B trong ngành ITO & nỗi đau CRM

> Tổng hợp từ [Business Playbook](https://docs.google.com/document/d/1JQj2wgSKYX73-xoecmDsrNzJLF1fUMKPov8WWKNAqQ4/edit) (BTC biên soạn từ Sales Playbook V1, chương trình P&C × HBLAB).
> Đây là phần **dùng trực tiếp trong ngày thi** — PRD sẽ liên quan phần lớn nội dung dưới đây.
> Quay lại [context tổng hợp](./hackathon-context.md).

## 1. Bối cảnh ITO — bán gì, cho ai

**ITO (IT Outsourcing):** bên bán là công ty dịch vụ phần mềm (HBLAB), bên mua là doanh nghiệp — ngân hàng, chuỗi bán lẻ, logistics, startup có vốn.

Mô hình bán phổ biến: **man-month** (số người × số tháng). Nhưng phải tách bạch:

- man-month chỉ là **cách tính giá**;
- thứ khách thực sự mua là **năng lực chuyên môn + tốc độ + độ linh hoạt + kiểm soát rủi ro**.

Cách tính theo giờ công đang bị AI đe doạ trực tiếp: AI giúp ít người làm được nhiều hơn → **năng suất càng tăng thì doanh thu càng giảm**. Mô hình man-month có thể phải biến đổi, thậm chí chấm dứt sớm.

**Đặc trưng deal ITO:**

- Giá trị lớn — chục nghìn → hàng triệu USD.
- Chu kỳ dài — vài tháng → hơn 1 năm từ lần chạm đầu tới ký.
- Nhiều người tham gia quyết định — không phải một cá nhân bấm "mua".

**Vị thế cạnh tranh:** thị trường rất đông (firm toàn cầu, India ITO, VN nội địa). Lợi thế VN: chi phí, độ linh hoạt, năng lực kỹ thuật đang lên. Điểm yếu: nhận diện thương hiệu, độ sâu seniority, hiện diện tại thị trường khách.

> Chúng ta hiếm khi thắng bằng "ai cũng biết tên mình" — thắng bằng **chọn đúng trận địa, đúng khách, đúng thời điểm**. Đó là lý do dữ liệu khách hàng chính xác, kịp thời đáng giá đến thế.

Mỗi khách hàng là **quan hệ dài hạn với dữ liệu tích luỹ theo thời gian**. Quên một cuộc gọi, bỏ lỡ một tin tức, để hồ sơ cũ đi vài tháng — **là mất tiền thật**.

### DX → AIX: dịch chuyển giá trị

**AIX (AI Transformation):** AI được đặt làm lõi để tái cấu trúc quy trình vận hành và ra quyết định tự động, không phải tính năng gắn thêm.

Phân khúc chịu áp lực nặng nhất — nằm thấp nhất chuỗi giá trị: **làm phần mềm theo spec có sẵn (custom build)** và **cho thuê người (staff augmentation / body shop)**.

Giá trị dịch chuyển lên theo 2 hướng:

- **Tư vấn:** managed service → **tư vấn chiến lược & kiến trúc** (giúp khách trả lời *làm cái gì, tại sao*).
- **Sản phẩm:** chuyên sâu nghiệp vụ (fintech, healthtech) → **product engineering** (chịu trách nhiệm sản phẩm có *đáng dùng* không, không chỉ có *chạy* không).

Value proposition dịch chuyển: *Cost Saving* → **Expertise** · *Resource* → **Innovation** · *Flexibility* → **Cost Efficiency dài hạn (ROI)**.

## 2. Từ điển tối thiểu

| Thuật ngữ | Nghĩa |
| --- | --- |
| **Company / Account** | Pháp nhân khách hàng tiềm năng hoặc đang giao dịch. Mọi dữ liệu khác gắn về đây |
| **Contact** | Cá nhân cụ thể thuộc một công ty — tên, chức danh, email |
| **PIC** (Person In Charge) | Người bên khách **thực sự sở hữu** nỗi đau/KPI/quyết định mua — không nhất thiết là người chức danh to nhất |
| **Opportunity / Deal** | Thương vụ đang theo đuổi tại một công ty, có giá trị & thời điểm dự kiến chốt. Một công ty có thể nhiều deal |
| **Pipeline / Stage** | Chuỗi giai đoạn deal đi qua tới ký (hoặc thua). **Chuyển giai đoạn là quyết định của con người** |
| **Activity** | Việc đã xảy ra và được ghi lại: gặp, gọi, gửi tài liệu, khách phản hồi — xếp thành dòng thời gian |
| **Next step** | Việc cụ thể sắp làm cho một deal, kèm ngày hạn. **Deal không có next step là deal đang bị bỏ quên** |
| **Lead** | Công ty/người mới biết đến, chưa kiểm chứng được gì |
| **SQL** (Sales Qualified Lead) | Lead đã kiểm chứng đủ điều kiện thành cơ hội thật |
| **ICP** (Ideal Customer Profile) | Bộ tiêu chí mô tả khách lý tưởng — quyết định công ty nào đáng theo đuổi, công ty nào bỏ qua |
| **Signal** | Sự kiện quan sát được từ nguồn công khai cho thấy công ty đang chuyển động: gọi vốn, đổi lãnh đạo, mở rộng, tuyển lớn |
| **Prospecting** | Quy trình tìm, hiểu, tiếp cận khách tiềm năng phù hợp — theo bước rõ ràng, không liên hệ ngẫu nhiên |
| **Outreach** | Hành động chủ động liên hệ (email, LinkedIn) — chỉ sau khi research đủ |
| **GTM** (Go-To-Market) | Kế hoạch chiến lược: đánh thị trường nào, thắng bằng cách nào, đo bằng gì |
| **CRM** | Nơi toàn bộ những thứ trên được ghi lại — **nguồn dữ liệu chuẩn duy nhất của đội sales** |

## 3. Phễu bán hàng — Selection > Volume

Quy trình đầy đủ một sales/BD đi qua:

```
Market Research → Giả thuyết ICP → Danh sách công ty mục tiêu
→ Screening (gắn nhãn Keep / Hold / Drop cho từng công ty)
→ Account Intelligence (research sâu công ty được giữ)
→ Scoring (chấm điểm ưu tiên) → Outreach → Meeting → Qualify thành SQL
→ Proposal → Ký hợp đồng
```

**Bước quyết định KHÔNG phải chốt deal — mà là bước 3: chọn đúng 50 công ty khớp ICP.** Chọn sai ở đây thì mọi nỗ lực phía sau đổ vào những công ty không bao giờ mua. Nguyên tắc: **Selection > Volume**.

Hai điểm quan trọng:

- **Screening là bộ lọc nhanh, không phải research.** Mỗi công ty chỉ xem vài phút, qua đúng thứ tự nguồn (công cụ sourcing → LinkedIn → website), và **mọi công ty phải nhận đúng một nhãn** Keep/Hold/Drop **kèm một câu lý do**. Không cho phép trạng thái mơ hồ kiểu "để xem sau".
- **Qualify = kiểm cả hai chiều.** Có thể *cần* (requirement) mà không *chi được* (budget) hoặc ngược lại. Chỉ theo đuổi khi có cả hai, và cả hai phải là **fact kiểm chứng được**: quy mô nhân sự & doanh thu → chỉ dấu budget; tech stack đang chạy & vendor đang trả tiền → chỉ dấu requirement.

## 4. Signals — dữ liệu cho biết "bây giờ là lúc"

**Khái niệm trung tâm của toàn bộ playbook.** Signal = sự kiện quan sát được từ **nguồn công khai**, cho thấy công ty đang chuyển động → đang có ngân sách, độ cấp bách, hoặc lý do để mua.

| Tín hiệu | Vì sao có nghĩa |
| --- | --- |
| **Gọi vốn / Funding** | Có tiền mới → sắp tiêu, thường vào sản phẩm & công nghệ. **Cửa sổ hành động tính bằng ngày** |
| **Bổ nhiệm lãnh đạo mới** (đặc biệt CTO/CIO) | Sếp mới → agenda mới → dự án mới → **vendor mới**. Người mới thường xem lại toàn bộ lựa chọn của người cũ |
| **Mở rộng** (văn phòng, thị trường mới) | Vận hành phình ra → hệ thống hiện tại quá tải → cần phần mềm |
| **Tuyển dụng quy mô lớn** (nhất là engineering) | Đang xây gì đó lớn hơn năng lực nội bộ → có thể cần thuê ngoài |

**Nguồn:** website công ty, LinkedIn, trang tuyển dụng, báo cáo thường niên, tin tức ngành, website sự kiện. Toàn bộ là nguồn công khai — **vấn đề chỉ là không ai có thời gian ngồi đọc hết mỗi ngày.**

Signal trả lời câu hỏi đắt giá nhất trong sales: **"Why now?"** — vì sao phải liên hệ công ty này *tuần này* chứ không phải quý sau.

> **Một tín hiệu tốt đến muộn là một tín hiệu vô giá trị:** khi tin gọi vốn đã lên mặt báo thì ba đối thủ đã gửi email trước rồi.

**Ví dụ ghép mảnh (dùng xuyên suốt playbook):** Công ty bán lẻ X (~800 nhân viên) vừa công bố Series B + trang tuyển dụng treo 12 tin tuyển engineer. Hai tín hiệu chồng lên nhau kể một câu chuyện: *họ sắp xây nhiều hơn tốc độ tuyển người kịp*. → Cửa sổ chào dedicated team, tính bằng **tuần**. Toàn bộ giá trị nằm ở việc **nhìn thấy sớm và ghép đúng**.

### 4.1. Fact vs Hypothesis — quy tắc quan trọng nhất

> **"Nếu không nêu được nguồn, insight vẫn chỉ là giả thuyết."**

- **Fact** = quan sát được, kiểm chứng được, chỉ ra được nguồn. *"Công ty X đăng 3 tin tuyển SAP consultant trong tháng này (link)."*
- **Hypothesis** = suy luận chưa xác nhận, dựng trên fact. *"Họ có thể đang thiếu nguồn lực cho dự án ERP."*

Cả hai đều hữu ích — sales giỏi dựng hypothesis tốt từ facts. **Lỗi chết người là trình bày hypothesis như thể nó là fact.** Sales mang điều hệ thống "khẳng định" đi nói với khách, hoá ra chỉ là phỏng đoán → mất mặt ngay trong cuộc họp. Niềm tin vào một nguồn thông tin **xây rất chậm, sập rất nhanh**: vài lần "khẳng định" hoá ra là đoán → người ta bỏ qua cả những lần nguồn đó nói đúng.

**Hệ quả thiết kế (ghim lại):** bất kỳ thông tin nào máy sinh ra cho sales đều phải (1) **phân biệt được nó là fact hay suy luận**, và (2) **truy ngược được về nguồn gốc**. Không có nguồn = không có giá trị.

## 5. ICP & 5 loại công ty khách hàng

```
ICP = loại công ty + nỗi đau + PIC + tín hiệu + độ phù hợp
```

| Loại | Họ là ai | Nhu cầu tiêu biểu | Người cần gặp |
| --- | --- | --- | --- |
| **Traditional** | DN truyền thống (ngân hàng, bán lẻ, sản xuất) đang chuyển đổi số | Chiến lược DX, hiện đại hoá hệ thống cũ | CEO, COO, CIO/CTO |
| **IT Solution** | Công ty triển khai giải pháp IT cho khách của họ | Customization, tích hợp, thêm người khi thiếu | CTO, Head of Delivery |
| **IT Product** | Công ty có sản phẩm phần mềm riêng | Xây tính năng, tăng tốc roadmap | CTO, VP Engineering |
| **Tech-based / Startup** | Startup vừa có vốn, cần ra sản phẩm nhanh | MVP, launch nhanh, scale sau funding | Founder, CTO |
| **ITO khác** | Công ty outsourcing khác đang quá tải | Thầu phụ, kỹ năng hiếm, nhận overflow | Delivery Director |

**Bài học cho người xây công cụ: "công ty" không phải một khối đồng nhất.** Cùng một tín hiệu (gọi vốn) mang ý nghĩa khác nhau tuỳ loại: với startup là "sắp xây MVP", với công ty product là "sắp tăng tốc roadmap". Cùng một dịch vụ cũng được đóng gói khác nhau: Traditional → consultative discovery + case study theo domain; startup → "MVP builder, vào việc nhanh"; ITO quá tải → bảng profiles, availability, rate.

**Tầng lọc cuối — Vietnam-fit:** ICP mạnh không chỉ là "công ty có nhu cầu", mà là công ty **nơi VN — cụ thể là chúng ta — có lý do để thắng** (bài toán hợp năng lực delivery, chênh lệch chi phí đủ hấp dẫn, múi giờ & giao tiếp làm việc được). **Có nhu cầu nhưng không có lý do thắng vẫn là Drop.**

## 6. Buyer Personas & nỗi đau 3 tầng

Không tồn tại "công ty quyết định mua" — chỉ có **những con người cụ thể** với vai khác nhau:

| Vai | Họ làm gì | Thường là ai |
| --- | --- | --- |
| **Economic buyer** | Nắm ngân sách, ký quyết định cuối | CEO, CFO, BU Head |
| **Technical evaluator** | Đánh giá kiến trúc, bảo mật, rủi ro kỹ thuật | CTO, CIO, Architect |
| **Business champion** | Người *cảm* nỗi đau hằng ngày, thúc đẩy từ bên trong | COO, Head of Product, VP Eng |
| **Procurement / blocker** | Kiểm soát hợp đồng, compliance, ép giá | Procurement, Legal |
| **User / operator** | Người sẽ dùng hệ thống, chịu đau vận hành | Đội ops, support |

Mỗi C-level quan tâm một thứ khác nhau → **cùng một dịch vụ phải kể bằng câu chuyện khác nhau**: CEO nghe "tăng trưởng", COO nghe "vận hành trơn", CFO nghe "chi phí & ROI", CTO nghe "hiện đại hoá & rủi ro công nghệ", CMO nghe "giữ chân khách hàng".

**Cảnh báo: đừng chỉ nhìn chức danh.** Có deal mà người quyết định thuê ngoài thực tế là COO chứ không phải CTO.

### Nỗi đau 3 tầng

1. **External** — áp lực bên ngoài: cạnh tranh, kỳ vọng khách hàng, quy định pháp lý, áp lực nhà đầu tư.
2. **Internal** — nút thắt bên trong sinh ra từ áp lực đó: thiếu người, backlog dồn, legacy, dữ liệu phân mảnh.
3. **Personal** — cái giá cá nhân PIC đang trả: KPI bị đe doạ, rủi ro danh tiếng, stress.

Công thức: *Vì [áp lực bên ngoài] tạo ra [nút thắt bên trong], [PIC] nhiều khả năng đang lo về [KPI/rủi ro cá nhân].*

> **Sales message mạnh nhất nói trúng tầng personal** — vì người nhiệt tình nhất với một giải pháp không phải người đứng đầu công ty, mà là **người đang trực tiếp chịu trận**.

### Bốn cái Đúng

```
Prospecting = RIGHT × (Account + Person + Timing + Message)
```

Bốn thừa số **nhân** với nhau — sai một cái là kết quả bằng 0:

- **Right Account** — công ty khớp ICP. *(Why this company?)*
- **Right Person** — đúng PIC sở hữu nỗi đau. *(Why this PIC?)*
- **Right Timing** — có tín hiệu cho thấy vấn đề đang "sống" quý này. *(Why now?)*
- **Right Message** — mở đầu bằng vấn đề của **họ**, không phải giới thiệu về mình. *(Why HBLAB / Why Vietnam?)*

**Chưa trả lời được cả bốn = chưa được viết message.** Playbook nói gắt: *"Gửi hàng loạt cùng một message tới 200 inbox không phải prospecting — đó là tạo tiếng ồn có deadline."* Khác biệt giữa sales giỏi và sales thường không nằm ở kỹ năng viết, mà ở **lượng research trước khi viết**.

## 7. Một ngày của Sales & nỗi đau CRM

Công việc hằng ngày của một sales/BD ở HBLAB:

- **Sáng:** rà tin tức/LinkedIn xem các công ty trong danh sách theo dõi có gì mới — **thủ công, tốn 1–2 giờ**.
- Cập nhật hồ sơ khách: ai vừa đổi chức danh, công ty nào vừa có tin — **gõ tay từng dòng**.
- Xem hôm nay phải làm gì: deal nào có next step đến hạn, deal nào đang bị bỏ quên.
- Gặp/gọi/email khách → về ghi lại activity.
- Kéo deal sang giai đoạn mới khi có tiến triển; ghi lý do khi thua.

Các thực thể lõi CRM — **Company, Contact, Opportunity (+stage), Activity timeline, Next step** — là bản dịch trực tiếp các việc trên thành dữ liệu.

### Hai nỗi đau kinh điển

1. **Hồ sơ luôn cũ.** Thế giới thay đổi liên tục, hồ sơ chỉ thay đổi khi có người gõ. **Khách gọi được vốn mà hồ sơ không biết = mất Right Timing = mất deal.**
2. **Nhập tay ăn hết thời gian.** Phần lớn thứ phải gõ là thông tin **máy hoàn toàn đọc được từ nguồn công khai**. Thời gian gõ là thời gian không bán hàng.

→ Đây chính là chỗ AIX chạm vào CRM: máy hoàn toàn có thể **đọc thay** và **chuẩn bị sẵn**.

**Nhưng nghịch lý:** chính vì CRM là nguồn dữ liệu chuẩn mà **sales cực kỳ khó tính với việc ai/cái gì được ghi vào đó**. Hồ sơ khách là thứ họ mang đi họp và chịu trách nhiệm từng dòng trước khách và trước sếp.

> **Một dòng dữ liệu sai trong CRM tệ hơn một dòng để trống** — dòng trống thì người ta biết là chưa có, dòng sai thì người ta *tin*.

## 8. Năm nguyên tắc vàng khi xây công cụ cho Sales

**Đây là spec ẩn của vòng 3 (Sales chấm).**

1. **Bằng chứng trước, khẳng định sau.** Mọi thông tin hệ thống đưa ra phải truy ngược được về nguồn — **đúng câu chữ, đúng chỗ**. "Máy nói thế" không phải là bằng chứng.
2. **Fact và suy luận phải phân biệt được ngay bằng mắt.** Người dùng không có thời gian đọc kỹ để tự phán đoán độ tin cậy — **độ tin cậy phải nhìn thấy được trước cả khi đọc nội dung**.
3. **Sales sở hữu dữ liệu của mình.** Máy giỏi nhất ở vai trò *chuẩn bị sẵn*; quyết định ghi gì vào hồ sơ là của người. Nếu có chỗ máy được tự làm, **chỗ đó phải sửa lại được dễ hơn cả lúc máy làm**.
4. **Độ đúng phải đo được.** Niềm tin xây bằng chuỗi lần đúng liên tiếp và sập sau một lần sai to. Không đo được tỉ lệ đúng thì không biết hệ thống đang được tin dùng hay đang bị âm thầm bỏ qua.
5. **Next step là nhịp tim của deal.** Câu hỏi quan trọng nhất mỗi sáng của sales là **"hôm nay tôi phải làm gì, cho deal nào"**. Công cụ trả lời tốt câu này được dùng hằng ngày; công cụ chỉ để báo cáo cho sếp sẽ bị bỏ hoang.

### Ngộ nhận thường gặp (tránh khi thiết kế)

- **"Sales = nói giỏi."** Sai. Sales hiện đại là **80% research và chọn lọc**, 20% giao tiếp. Bước thắng deal xảy ra trước cả email đầu tiên.
- **"Càng liên hệ nhiều càng tốt."** Sai. 200 email giống nhau là tiếng ồn; 20 email đúng người đúng lúc là pipeline.
- **"Budget cao = dễ thắng."** Sai. Khách hấp dẫn có thể đồng thời rất khó vào. Phải chấm **cả hai trục**: *đáng theo đuổi không* × *thắng được không*.
- **"CRM là công cụ báo cáo."** Sai — nếu chỉ thế, sales coi nhập liệu là **thuế phải nộp** và sẽ trốn. CRM tốt là công cụ *làm việc* của chính sales: giúp họ nhớ, nhắc đúng lúc, chuẩn bị sẵn.
- **"Cứ thêm AI là tốt."** Sai theo cách tinh vi: **một tính năng AI đúng 8/10 lần nhưng không chỉ ra được nguồn tệ hơn không có tính năng đó** — vì 2 lần sai sẽ phá niềm tin vào cả 8 lần đúng.

## 9. Tự kiểm tra trước ngày thi

Trả lời trơn tru được 7 câu này = đủ context nghiệp vụ:

1. Vì sao bước "chọn 50 công ty đúng" quan trọng hơn bước "chốt deal"?
2. Bốn loại tín hiệu kinh điển là gì, mỗi loại nói lên điều gì về ngân sách/độ cấp bách?
3. Vì sao cùng tín hiệu "gọi vốn" lại xử lý khác nhau với startup và công ty product?
4. Ai "cảm" nỗi đau hằng ngày trong công ty khách — vì sao người đó quan trọng dù không ký hợp đồng?
5. Fact khác hypothesis chỗ nào? Vì sao trộn lẫn phá huỷ niềm tin?
6. Vì sao một dòng dữ liệu *sai* trong CRM tệ hơn một dòng *trống*?
7. Một ngày của sales/BD gồm những việc gì, việc nào tốn thời gian nhất?

## 10. Playbook chưa theo kịp AIX (đọc thêm — không bắt buộc)

BTC lưu ý playbook hiện tại xây chủ yếu từ giai đoạn DX. Hai điểm cần cập nhật:

- **Phân loại khách (mục 5)** chia theo họ làm gì và mua phần mềm kiểu gì. Thời AIX cần thêm trục: **khách đang ở đâu trên đường ứng dụng AI**. Lợi thế "chi phí, nhân lực dồi dào" trong Vietnam-fit cũng là lợi thế của thời bán giờ công — AI san phẳng phần đó thì **lý do thắng phải viết lại**.
- **Danh sách tín hiệu (mục 4)** đều báo cùng một chuyện: khách sắp cần thêm người & phần mềm. Thời AIX có tín hiệu mới (tuyển vai trò AI/dữ liệu, ra mắt tính năng có AI, chuyển ngân sách từ thuê người sang nền tảng), và **tín hiệu cũ có thể đã đảo nghĩa** — "tuyển 12 engineer" giờ cũng có thể nghĩa là họ tự xây năng lực và sắp *giảm* thuê ngoài.

→ Đây là **vùng còn trống** — cơ hội ghi điểm nếu sản phẩm chạm vào được.

---

*Lưu hành nội bộ HBLAB. Các công ty trong ví dụ (như "công ty X") là tình huống minh hoạ, không phải khách hàng thật.*
