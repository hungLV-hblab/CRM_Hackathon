# Thiết kế phần mềm thế hệ AI-Native — từ CRUD sang Ontology

> Tổng hợp từ [PDF training nội bộ 08/08/2026](https://drive.google.com/file/d/1Zx8SMPBwWxw48k-pVRTJDzI4fD3e6QAI/view) (57 phút, bối cảnh: **dự án AI-native CRM** — đúng bối cảnh đề Hackathon).
> Quay lại [context tổng hợp](./hackathon-context.md).

## Tóm tắt 5 dòng

1. **Ontology** là lớp ngữ nghĩa nằm trên database: mô tả đối tượng — thuộc tính — **quan hệ có tên** của cả domain, để AI *suy luận* được thay vì chỉ đọc dữ liệu.
2. Có 2 trường phái AI-native từ 2 niềm tin khác nhau; **team chọn AI human-centric**: người và AI cùng tiến hoá, năng lực của người phải **đo được**.
3. Hệ thống AI-native thiết kế quanh 4 đối tượng nguyên thuỷ: **Observation → Claim → Proposal**, với **Provenance** làm sợi dây truy vết — thay cho tư duy CRUD thuần tuý.
4. AI có **trần tự chủ khai báo tường minh** (được crawl thoải mái, **không bao giờ tự gửi email cho khách**); người duyệt phải có **năng lực** duyệt, không chỉ chịu trách nhiệm.
5. **Playbook** — tri thức ngành đóng gói, có quyền commit — là thứ giúp cả AI lẫn người khôn lên qua vòng lặp giả định → kiểm chứng → cập nhật.

## 1. Vì sao cách thiết kế cũ không đủ

Quy trình cũ: phân tích nghiệp vụ → use case → ERD → code CRUD quanh các bảng. Tri thức domain bị chẻ nhỏ và giấu vào 3 chỗ:

- **Database** giữ cấu trúc — nhưng khoá ngoại chỉ nói "hai bảng này có liên kết", **không nói liên kết đó nghĩa là gì**.
- **Code** giữ hành vi — nhưng logic rải trong hàng nghìn function, muốn hiểu phải đọc từng nhánh if.
- **Đầu người** giữ phần còn lại — kinh nghiệm, quy ước, "cái này xưa nay vẫn làm thế".

Với người thì tạm ổn (bù bằng trao đổi). Nhưng khi AI trở thành "người làm việc" trong hệ thống, nó cần thứ cả ba nơi trên đều không cho: **ngữ nghĩa tường minh**. AI suy luận trên câu chữ và khái niệm, không suy luận được trên khoá ngoại vô danh hay logic ngầm.

> *"Trước giờ mình làm phần mềm, mình toàn làm ở tầng cành với tầng lá thôi — nên mình không hiểu. Ontology mô tả cái gốc, rồi mới rẽ ra các nhánh."*

**Thế hệ tiếp theo đảo lại thứ tự: mô tả tri thức domain trước, sinh cấu trúc kỹ thuật sau.**

## 2. Ontology — lớp ngữ nghĩa của domain

> **Định nghĩa (của team):** Ontology là bản mô tả **đối tượng, thuộc tính, và quan hệ có tên** của toàn bộ một domain — "bản thể" của hệ thống, từ đó mới ánh xạ ra bảng, trường, API và code. **Cả hệ thống là một ontology**; mỗi customer, mỗi deal chỉ là object bên trong nó.

| Công cụ | Mô tả được | Thiếu gì |
| --- | --- | --- |
| **ERD / Database** | Thực thể, trường, khoá ngoại | Khoá ngoại không nói quan hệ *là gì*. "Nhân viên **thuộc** team", "team **làm việc cho** khách hàng" — chữ *thuộc*, *làm việc cho* không tồn tại trong schema |
| **Knowledge graph** | Node và cạnh liên kết | Cạnh thuần tuý chỉ nói "có liên kết". Quan hệ thật có **loại và chiều phụ thuộc**: người mua–người bán, người cho vay–người nợ |
| **Use case** | Con người muốn làm gì với hệ thống | Chỉ là góc nhìn người dùng. Không mô tả bản chất đối tượng và quan hệ |
| **Ontology** | Đối tượng + thuộc tính + **quan hệ được đặt tên**, kèm ngữ nghĩa | *(lớp bao trùm — suy ra được cả ba thứ trên)* |

Ví dụ trong training: *"Khách hàng **đặt hàng** car seller; hệ thống viết bằng Java, **chạy trên** AWS, **được thực hiện bởi** team HBLab Japan; team **có thành viên** Nguyễn Văn A."* Mỗi động từ là một **quan hệ có tên** mà database không biểu diễn được.

**Ontology rộng hơn database:** email, file, meeting note, website — tất cả được trừu tượng hoá thành **nguồn thông tin** mà các đối tượng trong domain tương tác. Đó là lý do nó đủ sức làm nền cho AI: AI làm việc với cả thế giới phi cấu trúc, không chỉ với các bảng.

### Ontology trông thế nào trong repo?

Không cần công cụ đặc biệt — **các file markdown nằm cạnh code**, mô tả bằng lời:

- Domain gồm những đối tượng gì, thuộc tính gì, quan hệ ra sao (cái nào phụ thuộc cái nào, cái nào là gốc, cái nào là kết quả).
- **Chuỗi dẫn xuất giữa các tài liệu:** flow nghiệp vụ → danh sách chức năng → basic design → detail design → code — và cách sinh tài liệu sau từ tài liệu trước. Bình thường ta chỉ biết "hai tài liệu liên quan nhau"; ontology mô tả tường minh **tài liệu này là input của tài liệu kia** và phép biến đổi giữa chúng.

Hai điều đáng nhớ:

- **Mọi dự án sau này đều cần một file định nghĩa ontology** — nó là câu trả lời cho "dự án này làm domain gì".
- **Không ai viết tay toàn bộ**: có input (tài liệu nghiệp vụ, hệ thống đang chạy) thì **AI sinh bản nháp, người chỉnh và duyệt**.

Nếu từng làm DDD: xem ontology như **ubiquitous language được viết xuống thành tài liệu máy đọc được**, thay vì chỉ sống trong hội thoại của team.

> **Phân biệt:** buổi họp weekly của team sale **không** nằm trong ontology — họp là *hành động có mục đích*, còn ontology chỉ mô tả *đối tượng và quan hệ*. Nhưng **mục tiêu** của buổi họp ("nâng cấp quan hệ khách hàng từ lạnh → ấm → nóng") thì chính là các **trạng thái quan hệ** đã được ontology định nghĩa. Hành động thúc đẩy quan hệ dày lên; đối tượng và thuộc tính không đổi.

## 3. Hai trường phái AI-native — chọn hướng là chọn một niềm tin

Hiện **chưa có định nghĩa tiêu chuẩn** cho "AI-native platform".

| | **AI-CENTRIC** | **AI HUMAN-CENTRIC** ← team chọn |
| --- | --- | --- |
| **Niềm tin gốc** | AI cuối cùng sẽ làm được hết, không cần người can thiệp | AI và người cùng tiến hoá; AI không thay thế hoàn toàn phán đoán của người |
| **Định nghĩa** | AI làm việc là chính, người verify; rút AI ra thì hệ thống không còn gì | Người tương tác với AI để cả hai cùng khôn lên; **sự khôn lên của người phải đo được và quản lý được** |
| **Vai trò con người** | Đứng ở khâu approve cuối cùng | Đưa giả định, kiểm chứng, dạy lại hệ thống — có đủ không gian và bằng chứng để **verify thật** |
| **Điểm chết** | Người không đủ năng lực verify → "approve" chỉ là **đánh tráo khái niệm về trách nhiệm pháp lý** | Chậm hơn về throughput; đòi hỏi đầu tư vào đo lường năng lực |

> **Cạm bẫy của AI-centric:** giống xe tự lái hiện nay — luật vẫn cần một người ngồi sau vô lăng, nhưng người đó gần như không can thiệp được gì khi tai nạn xảy ra; việc duy nhất làm được là **đạp phanh**. AI quyết định hết, người chỉ còn trách nhiệm giải trình mà không có năng lực ra quyết định.
> **Phiên bản của cái bẫy này với đội phần mềm:** người review không hiểu output của AI nhưng vẫn bấm approve rồi submit cho khách hàng.

### Chỉ số đo "khôn lên" (thiết kế sẵn từ đầu)

| Chỉ số | Đo gì |
| --- | --- |
| **Auto-accept rate** | Tỉ lệ đề xuất của AI được chấp nhận không cần sửa → **đo hệ thống khôn lên** |
| **Error-detection rate** | Tỉ lệ người tìm ra được lỗi sai của AI → **đo người khôn lên**. Nếu không ai chỉ ra được error, không ai nghĩ ra use case mới → cả người lẫn AI đều đứng im |
| **Business metrics** (ROI, productivity) | Quan trọng nhưng là **lagging indicator** — trễ nhiều tháng, phụ thuộc nhiều yếu tố, không dùng làm tín hiệu vận hành hằng ngày |

## 4. Bốn đối tượng nguyên thuỷ (phần lõi)

Trong ontology của một AI-native platform, giá trị nguyên thuỷ không còn là record trong bảng, mà là 4 đối tượng sau — **chúng là đối tượng có quan hệ với nhau, không phải "tầng" xếp chồng**:

```
Observation ──→ Claim ──→ Proposal
      └────── Provenance ──────┘   (sợi dây truy vết, nối các mắt xích)
```

| Đối tượng | Định nghĩa |
| --- | --- |
| **Observation** | Dữ liệu thô quan sát được từ thế giới: bản crawl website, transcript cuộc họp, email, news. **Luôn gắn thời điểm** |
| **Claim** | Mệnh đề suy ra từ observation — **thông tin đã bị biến đổi**: bản summarize, quyết định trích xuất, action item, so sánh hai snapshot. **Có độ tin cậy: chắc chắn / phỏng đoán** |
| **Proposal** | Gợi ý hành động AI đưa cho người: "chuyển account từ ấm sang nóng", **kèm đầy đủ bằng chứng**. Người duyệt — **đây là điểm chạm governance** |
| **Provenance** | Đường đi từ mỗi claim về **đúng observation gốc** (bấm vào một nhận định thì **highlight được đoạn văn nguồn**) |

**Điểm tinh tế từ buổi thảo luận:**

- **Summarize cũng là claim**, dù mức biến đổi rất nhỏ — vì không có gì bảo đảm bản tóm tắt đúng. Ranh giới: **ghi chép 1-1 (write down) thì không phải claim; hễ biến đổi thông tin gốc là claim.**
- Một claim có thể dựa trên **nhiều nguồn**: action item rút từ một transcript là claim đơn giản; nhận định "công ty X vừa đổi định hướng" cần **so sánh observation tháng này với tháng trước**.
- **Proposal chỉ đáng tin khi trace được**: dựa trên quan sát nào, suy ra claim nào, đường đi giải thích ra sao. Đây là nguyên tắc **grounding/citation** của các hệ RAG, **nâng lên thành kiến trúc dữ liệu**.

### Từ CRUD sang 4 nhóm tính năng (ví dụ trong CRM)

Thay vì tư duy "màn hình nào, bảng nào, thêm-sửa-xoá gì", thiết kế tính năng theo 4 đối tượng:

| Đối tượng | Tính năng tương ứng |
| --- | --- |
| **Observation** | Crawl website công ty định kỳ (**lưu nguyên snapshot HTML theo thời điểm**), ingest meeting note, đọc & lọc nguồn tin theo độ tin cậy |
| **Claim** | Summarize, trích xuất quyết định & action item, **so sánh snapshot phát hiện thay đổi**, chấm ICP score & priority chạy ngầm |
| **Provenance** | Highlight câu trích nguồn, link từ mỗi nhận định về đúng đoạn văn gốc, **ràng buộc hệ thống: không có nguồn thì không hiển thị** |
| **Proposal** | Gợi ý nâng trạng thái quan hệ khách hàng kèm bằng chứng, **hàng đợi duyệt** cho người dùng, **ghi nhận accept/reject để đo auto-accept rate** |

Training dừng có chủ đích ở mức định nghĩa — cách hiện thực hoá (lưu trữ, model hoá, pipeline) là **bài toán của đội development**. Nhưng định nghĩa này giúp các mảnh kỹ thuật rời rạc (vector store, crawler, scoring...) trở thành **một hệ thống có concept đằng sau** — biết mình đang thừa gì, thiếu gì.

## 5. Trần quyền hạn & mức độ tự chủ của AI

AI-native **không** có nghĩa AI muốn làm gì thì làm. Khai báo quyền theo từng vùng, có **trần cứng không bao giờ vượt**:

| Vùng | Quyền |
| --- | --- |
| **Vùng tự do** | Ở mức **observation**: crawl news, insert dữ liệu quan sát, đọc nguồn — AI thao tác thoải mái |
| **Vùng chạy ngầm** | Chấm điểm, phân loại, đề xuất: AI tự làm nhưng **output chỉ là claim/proposal, chưa chạm vào dữ liệu chính thức** |
| **Vùng cấm tuyệt đối** | Ghi thẳng vào file ontology/policy: *"AI không bao giờ được tự gửi email cho khách hàng, trong mọi tình huống"*; *"không được sửa bất kỳ thông tin nào trong file hoa hồng"*. AI chỉ được **verify và báo "số liệu này sai"** — người phải là người sửa |

> **QUYỀN ≠ TRÁCH NHIỆM.** Người duyệt một proposal phải **đủ năng lực duyệt**, không chỉ là người ký tên chịu trách nhiệm. Hệ thống phải cung cấp **đủ bằng chứng** (observation, claim, provenance) và **đủ thời gian** để verify thật — **không ép năng suất đến mức việc duyệt chỉ còn là bấm accept**.

Đây chính là **least privilege + separation of duties** áp lên một "user" kiểu mới là AI agent. Điều mới: các quyền này được **mô tả bằng ngôn ngữ tự nhiên trong ontology**, nơi cả AI lẫn người cùng đọc được, thay vì chỉ nằm trong bảng phân quyền.

## 6. Playbook & vòng lặp cùng khôn lên

**Playbook** = tri thức ngành được đóng gói (với CRM là tri thức về nghề sale). Nó **không phải** một trong 4 đối tượng nguyên thuỷ — nó **đứng ẩn sau toàn bộ**: chỉ cho AI biết nên **quan sát cái gì**, **đúc rút thế nào**, và khi có đủ thông tin thì **hành động gì tiếp theo**.

Playbook được quản lý **như code**: có phiên bản, và quan trọng nhất là **có quyền commit** — ai được phép đưa một tri thức vào playbook là một quyết định **governance**, vì mọi hành vi của AI sau đó đều chịu ảnh hưởng.

**Vòng lặp học tập:**

```
1 · Giả định        Người đưa ra hypothesis — ví dụ thử một ICP mới khi vào thị trường chưa có insight
      ↓
2 · Kiểm chứng      AI đi thu thập, đối chiếu, chạy thử — việc người không thể làm ở quy mô hàng trăm nguồn
      ↓
3 · Đúc rút         ICP nào ăn, ICP nào không — insight rút ra từ thử-sai liên tục
      ↓
4 · Commit playbook Insight được duyệt và đưa vào playbook → AI khôn lên, và người (qua việc đặt giả định
                    và kiểm chứng) cũng khôn lên
```

> **Điểm mấu chốt:** nếu không dạy gì thêm, **AI không tự khôn lên** — nó chỉ khôn lên khi bạn đổi sang model frontier lớn hơn, thứ nằm ngoài kiểm soát của bạn. Tri thức của tổ chức phải dày lên ở khâu **evaluation**: biết điều gì là đúng, là hợp lý. Không có điều đó, cả hệ thống đứng im.
> **AI không giúp bạn "khôn" bằng cách làm hộ — nó giúp bạn khôn bằng cách kiểm chứng giả định của bạn nhanh hơn.**

## 7. Tháp độ tin cậy của nguồn thông tin

Mọi nguồn **không bình đẳng**. Thứ tự ưu tiên (đáng tin nhất → thấp nhất):

1. Bài báo học thuật có **peer review** (arXiv, journal article)
2. Website **chính phủ** (.gov)
3. Tổ chức phi chính phủ, tổ chức uy tín
4. **Private entity có thương hiệu lớn** (nghiên cứu từ Anthropic, các lab lớn)
5. Bài viết cá nhân, Medium, blog
6. **Social media** (Facebook, mạng xã hội — tầng thấp nhất)

**Nghịch lý cần nhớ:** phần lớn thông tin ta gặp hằng ngày đến từ **tầng thấp nhất**.

Tháp này áp dụng ở 2 chỗ:

- **Bộ lọc của tầng observation** trong hệ thống: mỗi observation **mang theo cấp nguồn của nó**, ảnh hưởng đến độ tin cậy của claim phía sau.
- **Phương pháp research của chính developer**: khái niệm mới thì đi **từ nguồn peer-reviewed xuống**, đừng đi từ social media lên.

## 8. Checklist cho developer

- [ ] Mỗi dự án có **một file ontology** (markdown, trong repo): đối tượng, thuộc tính, **quan hệ có tên**, chuỗi dẫn xuất tài liệu. Để AI sinh bản nháp từ tài liệu nghiệp vụ, người review.
- [ ] **Đặt tên quan hệ, không chỉ tạo khoá ngoại.** Khi thiết kế, viết được thành câu: "A thuộc B", "B làm việc cho C". **Nếu không gọi tên được quan hệ, bạn chưa hiểu domain.**
- [ ] **Phân loại mọi dữ liệu AI tạo ra** vào đúng đối tượng: đây là observation, claim, hay proposal? Claim thì độ tin cậy bao nhiêu, nguồn từ observation nào?
- [ ] **Không có provenance thì không hiển thị.** Mọi nhận định AI đưa ra phải bấm vào truy được về nguồn gốc.
- [ ] **Khai báo trần tự chủ tường minh ngay từ thiết kế:** AI được tự làm gì, làm nhưng phải chờ duyệt gì, và tuyệt đối không được làm gì.
- [ ] **Đo auto-accept rate và error-detection rate từ ngày đầu** — thiết kế sẵn chỗ ghi nhận accept/reject/sửa trên mỗi proposal.
- [ ] **Đối xử với playbook như code:** có version, có review, có quyền commit rõ ràng.
- [ ] **Research theo tháp nguồn tin:** khái niệm mới thì tìm từ peer review / arXiv xuống, luôn giữ được đường dẫn về nguồn gốc để người khác kiểm chứng.

---

*Lưu ý của tài liệu gốc: các thuật ngữ Observation / Claim / Provenance / Proposal **chưa phải chuẩn ngành** — AI-native platform hiện chưa có định nghĩa tiêu chuẩn; đây là **định nghĩa làm việc của team**, sẽ tiến hoá cùng dự án.*
